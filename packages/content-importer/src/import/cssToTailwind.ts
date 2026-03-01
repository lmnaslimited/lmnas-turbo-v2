export type CssDeclarations = Record<string, string>;

export type CssNodeInput = {
  path: string;
  declarations?: CssDeclarations;
  existingClassName?: string;
};

const spacingScaleMap: Record<string, string> = {
  "0": "0",
  "0px": "0",
  "0rem": "0",
  "2px": "0.5",
  "4px": "1",
  "8px": "2",
  "12px": "3",
  "16px": "4",
  "20px": "5",
  "24px": "6",
  "32px": "8",
  "40px": "10",
  "48px": "12",
  "64px": "16"
};

const fontSizeMap: Record<string, string> = {
  "12px": "text-xs",
  "14px": "text-sm",
  "16px": "text-base",
  "18px": "text-lg",
  "20px": "text-xl",
  "24px": "text-2xl",
  "30px": "text-3xl"
};

const fontWeightMap: Record<string, string> = {
  "400": "font-normal",
  normal: "font-normal",
  "500": "font-medium",
  medium: "font-medium",
  "600": "font-semibold",
  semibold: "font-semibold",
  "700": "font-bold",
  bold: "font-bold"
};

const radiusMap: Record<string, string> = {
  "0": "rounded-none",
  "0px": "rounded-none",
  "2px": "rounded-sm",
  "4px": "rounded",
  "6px": "rounded-md",
  "8px": "rounded-lg",
  "12px": "rounded-xl",
  "16px": "rounded-2xl",
  "9999px": "rounded-full"
};

const lineHeightMap: Record<string, string> = {
  "1": "leading-none",
  "1.25": "leading-tight",
  "1.375": "leading-snug",
  "1.5": "leading-normal",
  "1.625": "leading-relaxed",
  "2": "leading-loose"
};

const shadowMap: Record<string, string> = {
  "0 1px 2px rgba(0,0,0,0.05)": "shadow-sm",
  "0 1px 3px rgba(0,0,0,0.1),0 1px 2px rgba(0,0,0,0.06)": "shadow",
  "0 4px 6px rgba(0,0,0,0.1),0 2px 4px rgba(0,0,0,0.06)": "shadow-md",
  "0 10px 15px rgba(0,0,0,0.1),0 4px 6px rgba(0,0,0,0.05)": "shadow-lg"
};

const directValueMap: Record<string, Record<string, string>> = {
  display: {
    block: "block",
    "inline-block": "inline-block",
    inline: "inline",
    flex: "flex",
    grid: "grid",
    none: "hidden"
  },
  "text-align": {
    left: "text-left",
    center: "text-center",
    right: "text-right",
    justify: "text-justify"
  }
};

function normalizeDeclarationKey(value: string): string {
  return value.trim().toLowerCase();
}

function normalizeDeclarationValue(value: string): string {
  return value.trim().replace(/\s+/g, " ").toLowerCase();
}

function normalizeArbitraryValue(value: string): string {
  return value.trim().replace(/\s+/g, "_").replace(/\]/g, "\\]");
}

export function parseInlineStyle(styleText: string): CssDeclarations {
  const declarations: CssDeclarations = {};
  const entries = styleText
    .split(";")
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);

  for (const entry of entries) {
    const separatorIndex = entry.indexOf(":");
    if (separatorIndex === -1) {
      continue;
    }

    const property = normalizeDeclarationKey(entry.slice(0, separatorIndex));
    const value = normalizeDeclarationValue(entry.slice(separatorIndex + 1));
    if (!property || !value) {
      continue;
    }

    declarations[property] = value;
  }

  return declarations;
}

function mapSpacingUtility(prefix: string, value: string): string {
  const mapped = spacingScaleMap[value];
  if (mapped) {
    return `${prefix}-${mapped}`;
  }
  return `${prefix}-[${normalizeArbitraryValue(value)}]`;
}

function mapColorUtility(prefix: string, value: string): string {
  const normalized = value.replace(/\s+/g, "");
  return `${prefix}-[${normalized}]`;
}

function mapDeclarationToUtility(property: string, value: string): string | null {
  if (directValueMap[property]?.[value]) {
    return directValueMap[property][value];
  }

  if (property === "font-size") {
    return fontSizeMap[value] ?? `text-[${normalizeArbitraryValue(value)}]`;
  }

  if (property === "font-weight") {
    return fontWeightMap[value] ?? `font-[${normalizeArbitraryValue(value)}]`;
  }

  if (property === "line-height") {
    return lineHeightMap[value] ?? `leading-[${normalizeArbitraryValue(value)}]`;
  }

  if (property === "color") {
    return mapColorUtility("text", value);
  }

  if (property === "background" || property === "background-color") {
    return mapColorUtility("bg", value);
  }

  if (property === "margin") {
    return mapSpacingUtility("m", value);
  }

  if (property === "margin-top") {
    return mapSpacingUtility("mt", value);
  }

  if (property === "margin-right") {
    return mapSpacingUtility("mr", value);
  }

  if (property === "margin-bottom") {
    return mapSpacingUtility("mb", value);
  }

  if (property === "margin-left") {
    return mapSpacingUtility("ml", value);
  }

  if (property === "padding") {
    return mapSpacingUtility("p", value);
  }

  if (property === "padding-top") {
    return mapSpacingUtility("pt", value);
  }

  if (property === "padding-right") {
    return mapSpacingUtility("pr", value);
  }

  if (property === "padding-bottom") {
    return mapSpacingUtility("pb", value);
  }

  if (property === "padding-left") {
    return mapSpacingUtility("pl", value);
  }

  if (property === "border-radius") {
    return radiusMap[value] ?? `rounded-[${normalizeArbitraryValue(value)}]`;
  }

  if (property === "box-shadow") {
    return shadowMap[value] ?? `shadow-[${normalizeArbitraryValue(value)}]`;
  }

  if (property === "width") {
    return `w-[${normalizeArbitraryValue(value)}]`;
  }

  if (property === "height") {
    return `h-[${normalizeArbitraryValue(value)}]`;
  }

  return null;
}

function splitClassNames(value: string | undefined): string[] {
  if (!value) {
    return [];
  }

  return value
    .split(/\s+/)
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);
}

export function mapCssDeclarationsToUtilities(declarations: CssDeclarations): string[] {
  const utilities: string[] = [];
  const keys = Object.keys(declarations).sort((a, b) => a.localeCompare(b));

  for (const key of keys) {
    const utility = mapDeclarationToUtility(normalizeDeclarationKey(key), normalizeDeclarationValue(declarations[key]));
    if (utility) {
      utilities.push(utility);
    }
  }

  return Array.from(new Set(utilities)).sort((a, b) => a.localeCompare(b));
}

export function emitClassMap(nodes: CssNodeInput[]): Record<string, string> {
  const sortedNodes = [...nodes].sort((a, b) => a.path.localeCompare(b.path));
  const classMapEntries: Array<[string, string]> = [];

  for (const node of sortedNodes) {
    const existingClasses = splitClassNames(node.existingClassName);
    const mappedUtilities = mapCssDeclarationsToUtilities(node.declarations ?? {});

    const merged = Array.from(new Set([...existingClasses, ...mappedUtilities])).sort((a, b) => a.localeCompare(b));
    if (merged.length > 0) {
      classMapEntries.push([node.path, merged.join(" ")]);
    }
  }

  return Object.fromEntries(classMapEntries);
}

export function collectSafelistClasses(classMap: Record<string, string>): string[] {
  const classes = new Set<string>();

  for (const key of Object.keys(classMap).sort((a, b) => a.localeCompare(b))) {
    for (const className of splitClassNames(classMap[key])) {
      classes.add(className);
    }
  }

  return Array.from(classes).sort((a, b) => a.localeCompare(b));
}
