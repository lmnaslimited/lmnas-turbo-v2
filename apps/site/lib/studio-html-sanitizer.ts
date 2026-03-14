export type SanitizedDomTextNode = {
  kind: "text";
  text: string;
};

export type SanitizedDomElementNode = {
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

const TOKEN_PATTERN = /<!--[\s\S]*?-->|<\/?[A-Za-z][^>]*>|[^<]+/g;
const ATTRIBUTE_PATTERN = /([^\s"'<>/=]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g;
const EXPLICIT_PROTOCOL_PATTERN = /^[a-z][a-z0-9+.-]*:/i;

const SAFE_TAGS = new Set([
  "a",
  "article",
  "aside",
  "b",
  "blockquote",
  "br",
  "button",
  "code",
  "div",
  "em",
  "figcaption",
  "figure",
  "footer",
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
  "header",
  "hr",
  "img",
  "li",
  "main",
  "nav",
  "ol",
  "p",
  "pre",
  "section",
  "small",
  "span",
  "strong",
  "sub",
  "sup",
  "table",
  "tbody",
  "td",
  "th",
  "thead",
  "tr",
  "u",
  "ul"
]);

const VOID_TAGS = new Set(["area", "base", "br", "col", "embed", "hr", "img", "input", "link", "meta", "param", "source", "track", "wbr"]);
const URL_ATTRIBUTES = new Set(["href", "src", "action", "poster", "formaction", "cite"]);
const PASSTHROUGH_ATTRIBUTES = new Set(["alt", "colspan", "href", "id", "rel", "rowspan", "scope", "src", "srcset", "target", "title"]);
const SAFE_PROTOCOLS = new Set(["http:", "https:", "mailto:", "tel:"]);

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
    if (!SAFE_PROTOCOLS.has(normalizedUrl.protocol.toLowerCase())) {
      return null;
    }

    normalizedUrl.protocol = normalizedUrl.protocol.toLowerCase();
    normalizedUrl.hostname = normalizedUrl.hostname.toLowerCase();
    normalizedUrl.hash = "";
    return normalizedUrl.toString();
  } catch {
    if (EXPLICIT_PROTOCOL_PATTERN.test(trimmed)) {
      return null;
    }
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

    if (/expression\s*\(/i.test(rawValue) || /javascript:/i.test(rawValue) || /data:text\/html/i.test(rawValue)) {
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

function sanitizeAttribute(name: string, value: string, sourceUrl: string): [string, string] | null {
  const normalizedName = name.toLowerCase();
  if (normalizedName.startsWith("on")) {
    return null;
  }

  if (normalizedName === "style") {
    const sanitizedStyle = sanitizeInlineStyleValue(value, sourceUrl);
    return sanitizedStyle ? [normalizedName, sanitizedStyle] : null;
  }

  if (normalizedName === "srcset") {
    const normalizedSrcset = normalizeSrcSetValue(value, sourceUrl);
    return normalizedSrcset ? [normalizedName, normalizedSrcset] : null;
  }

  if (URL_ATTRIBUTES.has(normalizedName)) {
    const normalizedUrl = normalizeUrlValue(value, sourceUrl);
    return normalizedUrl ? [normalizedName, normalizedUrl] : null;
  }

  if (normalizedName === "class") {
    const normalizedClass = value.trim().replace(/\s+/g, " ");
    return normalizedClass ? [normalizedName, normalizedClass] : null;
  }

  if (
    normalizedName.startsWith("data-") ||
    normalizedName.startsWith("aria-") ||
    PASSTHROUGH_ATTRIBUTES.has(normalizedName)
  ) {
    const normalizedValue = value.trim();
    return normalizedValue ? [normalizedName, normalizedValue] : null;
  }

  return null;
}

function normalizeRenderTag(tag: string): string {
  const normalized = tag.toLowerCase();
  return SAFE_TAGS.has(normalized) ? normalized : "div";
}

function parseOpenTag(token: string, sourceUrl: string): ParsedOpenTag | null {
  const selfClosing = token.endsWith("/>");
  const raw = token.slice(1, selfClosing ? -2 : -1).trim();
  if (!raw || raw.startsWith("!") || raw.startsWith("?") || raw.startsWith("/")) {
    return null;
  }

  const firstSpace = raw.search(/\s/);
  const tagName = normalizeRenderTag(firstSpace === -1 ? raw : raw.slice(0, firstSpace));
  const attributeSource = firstSpace === -1 ? "" : raw.slice(firstSpace + 1);
  const attributesMap = new Map<string, string>();

  ATTRIBUTE_PATTERN.lastIndex = 0;
  let attributeMatch: RegExpExecArray | null = ATTRIBUTE_PATTERN.exec(attributeSource);
  while (attributeMatch) {
    const rawName = attributeMatch[1];
    const rawValue = attributeMatch[2] ?? attributeMatch[3] ?? attributeMatch[4] ?? rawName;
    const sanitized = sanitizeAttribute(rawName, rawValue, sourceUrl);
    if (sanitized) {
      attributesMap.set(sanitized[0], sanitized[1]);
    }
    attributeMatch = ATTRIBUTE_PATTERN.exec(attributeSource);
  }

  return {
    tag: tagName,
    attributes: Object.fromEntries(Array.from(attributesMap.entries()).sort(([left], [right]) => left.localeCompare(right))),
    selfClosing
  };
}

export function sanitizeDomToJson(html: string, sourceUrl: string): SanitizedDomRoot {
  const root: SanitizedDomRoot = { kind: "root", children: [] };
  const cleaned = stripUnsafeTags(html);
  const tokens = cleaned.match(TOKEN_PATTERN) ?? [];
  const stack: Array<SanitizedDomRoot | SanitizedDomElementNode> = [root];

  for (const token of tokens) {
    if (token.startsWith("</")) {
      const closingTag = normalizeRenderTag(token.slice(2, -1).trim());
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

      if (!parsedTag.selfClosing && !VOID_TAGS.has(parsedTag.tag)) {
        stack.push(elementNode);
      }
      continue;
    }

    const normalizedText = normalizeTextValue(token);
    if (!normalizedText) {
      continue;
    }

    stack[stack.length - 1].children.push({
      kind: "text",
      text: normalizedText
    });
  }

  return root;
}

function escapeHtmlText(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function escapeHtmlAttribute(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function serializeNode(node: SanitizedDomNode): string {
  if (node.kind === "text") {
    return escapeHtmlText(node.text);
  }

  const tag = normalizeRenderTag(node.tag);
  const attributes = Object.entries(node.attributes)
    .filter(([name]) => {
      return (
        name === "class" ||
        name === "style" ||
        name.startsWith("data-") ||
        name.startsWith("aria-") ||
        PASSTHROUGH_ATTRIBUTES.has(name)
      );
    })
    .map(([name, value]) => ` ${name}="${escapeHtmlAttribute(value)}"`)
    .join("");

  if (VOID_TAGS.has(tag)) {
    return `<${tag}${attributes}>`;
  }

  const children = node.children.map((child) => serializeNode(child)).join("");
  return `<${tag}${attributes}>${children}</${tag}>`;
}

export function serializeSanitizedDomToHtml(root: SanitizedDomRoot): string {
  return root.children.map((child) => serializeNode(child)).join("");
}

export function sanitizeHtmlToSafeMarkup(html: string, sourceUrl: string): string {
  return serializeSanitizedDomToHtml(sanitizeDomToJson(html, sourceUrl));
}
