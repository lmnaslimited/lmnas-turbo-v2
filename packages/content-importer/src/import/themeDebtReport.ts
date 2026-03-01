import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  defaultThemeTokenRegistry,
  matchThemeToken,
  normalizeThemeKey,
  type ThemeTokenRegistry,
  type ThemeTokenType
} from "./themeTokens.js";

export type ThemeDebtUnknownToken = {
  tokenType: ThemeTokenType;
  tokenKey: string;
  rawValue: string;
};

export type ThemeDebtNearestMatch = {
  tokenType: ThemeTokenType;
  rawValue: string;
  matchedTokenKey: string;
  deltaE: number;
};

export type ThemeDebtHardFailure = {
  tokenType: ThemeTokenType;
  rawValue: string;
  reason: string;
};

export type ThemeDebtReport = {
  schemaVersion: "theme-debt.v1";
  themeKey: string;
  generatedAt: string;
  unknownTokens: ThemeDebtUnknownToken[];
  nearestMatches: ThemeDebtNearestMatch[];
  hardFailures: ThemeDebtHardFailure[];
  summary: {
    unknownCount: number;
    softMatchCount: number;
    hardFailureCount: number;
  };
};

export type ThemeDebtDeclarationInput = {
  tokenType: ThemeTokenType;
  tokenKey: string;
  rawValue: string;
};

export type ThemeDebtCssDeclarationInput = {
  path: string;
  declarations: Record<string, string>;
};

export function buildThemeDebtEntriesFromCss(inputs: ThemeDebtCssDeclarationInput[]): ThemeDebtDeclarationInput[] {
  const entries: ThemeDebtDeclarationInput[] = [];

  for (const input of inputs) {
    const keys = Object.keys(input.declarations).sort((left, right) => left.localeCompare(right));
    for (const key of keys) {
      const value = input.declarations[key];
      const normalizedKey = key.trim().toLowerCase();
      const normalizedValue = value.trim().toLowerCase();

      if (!normalizedValue) {
        continue;
      }

      if (normalizedKey === "color" || normalizedKey === "background-color" || normalizedKey === "background") {
        entries.push({
          tokenType: "colors",
          tokenKey: `${input.path}.${normalizedKey}`,
          rawValue: normalizedValue
        });
        continue;
      }

      if (normalizedKey === "font-size" || normalizedKey === "font-weight" || normalizedKey === "line-height") {
        entries.push({
          tokenType: "typography",
          tokenKey: `${input.path}.${normalizedKey}`,
          rawValue: normalizedValue
        });
        continue;
      }

      if (normalizedKey === "border-radius") {
        entries.push({
          tokenType: "radius",
          tokenKey: `${input.path}.${normalizedKey}`,
          rawValue: normalizedValue
        });
        continue;
      }

      if (normalizedKey === "box-shadow") {
        entries.push({
          tokenType: "shadow",
          tokenKey: `${input.path}.${normalizedKey}`,
          rawValue: normalizedValue
        });
      }
    }
  }

  return entries.sort((left, right) => {
    if (left.tokenType !== right.tokenType) {
      return left.tokenType.localeCompare(right.tokenType);
    }
    if (left.tokenKey !== right.tokenKey) {
      return left.tokenKey.localeCompare(right.tokenKey);
    }
    return left.rawValue.localeCompare(right.rawValue);
  });
}

export function buildThemeDebtReport(input: {
  themeKey: string;
  declarations: ThemeDebtDeclarationInput[];
  generatedAt?: string;
  registry?: ThemeTokenRegistry;
  distanceFn?: (leftHex: string, rightHex: string) => number;
}): ThemeDebtReport {
  const registry = input.registry ?? defaultThemeTokenRegistry;
  const unknownTokens: ThemeDebtUnknownToken[] = [];
  const nearestMatches: ThemeDebtNearestMatch[] = [];
  const hardFailures: ThemeDebtHardFailure[] = [];

  for (const declaration of input.declarations) {
    const match = matchThemeToken(
      declaration.tokenType,
      declaration.rawValue,
      registry,
      input.distanceFn
    );

    if (match.status === "unknown") {
      unknownTokens.push({
        tokenType: declaration.tokenType,
        tokenKey: declaration.tokenKey,
        rawValue: declaration.rawValue
      });
      continue;
    }

    if (match.status === "soft") {
      nearestMatches.push({
        tokenType: declaration.tokenType,
        rawValue: declaration.rawValue,
        matchedTokenKey: match.tokenKey,
        deltaE: Number(match.deltaE.toFixed(3))
      });
      continue;
    }

    if (match.status === "hard-failure") {
      hardFailures.push({
        tokenType: declaration.tokenType,
        rawValue: declaration.rawValue,
        reason: match.reason
      });
    }
  }

  return {
    schemaVersion: "theme-debt.v1",
    themeKey: normalizeThemeKey(input.themeKey),
    generatedAt: input.generatedAt ?? new Date().toISOString(),
    unknownTokens,
    nearestMatches,
    hardFailures,
    summary: {
      unknownCount: unknownTokens.length,
      softMatchCount: nearestMatches.length,
      hardFailureCount: hardFailures.length
    }
  };
}

export async function writeThemeDebtReport(filePath: string, report: ThemeDebtReport): Promise<void> {
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, stableStringify(report), "utf8");
}

function stableStringify(value: unknown): string {
  return `${JSON.stringify(sortKeys(value), null, 2)}\n`;
}

function sortKeys(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(sortKeys);
  }

  if (value && typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>).sort(([left], [right]) =>
      left.localeCompare(right)
    );
    return Object.fromEntries(entries.map(([key, val]) => [key, sortKeys(val)]));
  }

  return value;
}
