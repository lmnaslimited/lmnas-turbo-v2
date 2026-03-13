type SanitizedDomTextNode = {
  kind: "text";
  text: string;
};

type SanitizedDomElementNode = {
  kind: "element";
  tag: string;
  attributes: Record<string, string>;
  children: SanitizedDomNode[];
};

export type SanitizedDomNode = SanitizedDomTextNode | SanitizedDomElementNode;

export type SanitizedDomRoot = {
  kind: "root";
  children: SanitizedDomNode[];
};

type ParsedOpenTag = {
  tag: string;
  attributes: Record<string, string>;
  selfClosing: boolean;
};

const tokenPattern = /<!--[\s\S]*?-->|<\/?[A-Za-z][^>]*>|[^<]+/g;
const attributePattern = /([^\s"'<>/=]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g;

const voidElements = new Set([
  "area",
  "base",
  "br",
  "col",
  "embed",
  "hr",
  "img",
  "input",
  "link",
  "meta",
  "param",
  "source",
  "track",
  "wbr"
]);

const urlAttributes = new Set(["href", "src", "action", "poster", "formaction", "cite"]);

function stripUnsafeTags(html: string): string {
  return html
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, "");
}

function normalizeTextValue(text: string): string | null {
  const normalized = text.replace(/\s+/g, " ").trim();
  return normalized.length > 0 ? normalized : null;
}

function normalizeUrlValue(value: string, sourceUrl: string): string | null {
  const trimmed = value.trim();
  if (!trimmed || /^javascript:/i.test(trimmed)) {
    return null;
  }

  try {
    const normalizedUrl = new URL(trimmed, sourceUrl);
    if (normalizedUrl.protocol.toLowerCase() === "javascript:") {
      return null;
    }

    normalizedUrl.protocol = normalizedUrl.protocol.toLowerCase();
    normalizedUrl.hostname = normalizedUrl.hostname.toLowerCase();
    normalizedUrl.hash = "";
    return normalizedUrl.toString();
  } catch {
    return trimmed;
  }
}

function normalizeSrcSetValue(value: string, sourceUrl: string): string | null {
  const entries = value
    .split(",")
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);

  const normalizedEntries: string[] = [];
  for (const entry of entries) {
    const parts = entry.split(/\s+/).filter((part) => part.length > 0);
    if (parts.length === 0) {
      continue;
    }

    const [rawUrl, ...descriptors] = parts;
    const normalizedUrl = normalizeUrlValue(rawUrl, sourceUrl);
    if (!normalizedUrl) {
      continue;
    }

    normalizedEntries.push([normalizedUrl, ...descriptors].join(" "));
  }

  if (normalizedEntries.length === 0) {
    return null;
  }

  return normalizedEntries.join(", ");
}

function sanitizeAttribute(name: string, value: string, sourceUrl: string): [string, string] | null {
  const normalizedName = name.toLowerCase();
  if (normalizedName.startsWith("on")) {
    return null;
  }

  if (normalizedName === "style") {
    const sanitizedStyle = sanitizeInlineStyleValue(value, sourceUrl);
    if (!sanitizedStyle) {
      return null;
    }
    return [normalizedName, sanitizedStyle];
  }

  if (normalizedName === "srcset") {
    const normalizedSrcset = normalizeSrcSetValue(value, sourceUrl);
    if (!normalizedSrcset) {
      return null;
    }
    return [normalizedName, normalizedSrcset];
  }

  if (urlAttributes.has(normalizedName)) {
    const normalizedUrl = normalizeUrlValue(value, sourceUrl);
    if (!normalizedUrl) {
      return null;
    }
    return [normalizedName, normalizedUrl];
  }

  if (normalizedName === "class") {
    const normalizedClass = value.trim().replace(/\s+/g, " ");
    if (!normalizedClass) {
      return null;
    }
    return [normalizedName, normalizedClass];
  }

  const normalizedValue = value.trim();
  return [normalizedName, normalizedValue];
}

function sanitizeInlineStyleValue(value: string, sourceUrl: string): string | null {
  const declarations = value
    .split(";")
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);

  const sanitized: string[] = [];

  for (const declaration of declarations) {
    const separatorIndex = declaration.indexOf(":");
    if (separatorIndex === -1) {
      continue;
    }

    const property = declaration.slice(0, separatorIndex).trim().toLowerCase();
    const rawValue = declaration.slice(separatorIndex + 1).trim();
    if (!property || !rawValue) {
      continue;
    }

    if (/expression\s*\(/i.test(rawValue) || /javascript:/i.test(rawValue)) {
      continue;
    }

    const normalizedValue = rawValue.replace(/url\(([^)]+)\)/gi, (_match, rawUrl: string) => {
      const cleaned = rawUrl.trim().replace(/^['"]|['"]$/g, "");
      const normalizedUrl = normalizeUrlValue(cleaned, sourceUrl);
      if (!normalizedUrl) {
        return "url()";
      }
      return `url("${normalizedUrl}")`;
    });

    if (normalizedValue.includes("url()")) {
      continue;
    }

    sanitized.push(`${property}: ${normalizedValue}`);
  }

  if (sanitized.length === 0) {
    return null;
  }

  return sanitized.join("; ");
}

function parseOpenTag(token: string, sourceUrl: string): ParsedOpenTag | null {
  const selfClosing = token.endsWith("/>");
  const raw = token.slice(1, selfClosing ? -2 : -1).trim();
  if (!raw || raw.startsWith("!") || raw.startsWith("?") || raw.startsWith("/")) {
    return null;
  }

  const firstSpace = raw.search(/\s/);
  const tagName = (firstSpace === -1 ? raw : raw.slice(0, firstSpace)).toLowerCase();
  const attributeSource = firstSpace === -1 ? "" : raw.slice(firstSpace + 1);
  const attributesMap = new Map<string, string>();

  attributePattern.lastIndex = 0;
  let attributeMatch: RegExpExecArray | null = attributePattern.exec(attributeSource);
  while (attributeMatch) {
    const rawName = attributeMatch[1];
    const rawValue = attributeMatch[2] ?? attributeMatch[3] ?? attributeMatch[4] ?? rawName;
    const sanitized = sanitizeAttribute(rawName, rawValue, sourceUrl);
    if (sanitized) {
      attributesMap.set(sanitized[0], sanitized[1]);
    }
    attributeMatch = attributePattern.exec(attributeSource);
  }

  const attributes = Object.fromEntries(Array.from(attributesMap.entries()).sort(([a], [b]) => a.localeCompare(b)));
  return {
    tag: tagName,
    attributes,
    selfClosing
  };
}

export function sanitizeDomToJson(html: string, sourceUrl: string): SanitizedDomRoot {
  const root: SanitizedDomRoot = { kind: "root", children: [] };
  const cleaned = stripUnsafeTags(html);
  const tokens = cleaned.match(tokenPattern) ?? [];
  const stack: Array<SanitizedDomRoot | SanitizedDomElementNode> = [root];

  for (const token of tokens) {
    if (token.startsWith("</")) {
      const closingTag = token.slice(2, -1).trim().toLowerCase();
      for (let index = stack.length - 1; index > 0; index -= 1) {
        const candidate = stack[index];
        if (candidate.kind === "element" && candidate.tag === closingTag) {
          stack.length = index;
          break;
        }
      }
      continue;
    }

    if (token.startsWith("<")) {
      const parsedTag = parseOpenTag(token, sourceUrl);
      if (!parsedTag) {
        continue;
      }

      const currentParent = stack[stack.length - 1];
      const elementNode: SanitizedDomElementNode = {
        kind: "element",
        tag: parsedTag.tag,
        attributes: parsedTag.attributes,
        children: []
      };
      currentParent.children.push(elementNode);

      if (!parsedTag.selfClosing && !voidElements.has(parsedTag.tag)) {
        stack.push(elementNode);
      }
      continue;
    }

    const normalizedText = normalizeTextValue(token);
    if (!normalizedText) {
      continue;
    }

    const currentParent = stack[stack.length - 1];
    currentParent.children.push({
      kind: "text",
      text: normalizedText
    });
  }

  return root;
}
