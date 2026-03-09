import fs from "node:fs";
import path from "node:path";

const bootstrapped = new Set<string>();

function parseEnvLine(line: string): { key: string; value: string } | null {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith("#")) {
    return null;
  }

  const equalIndex = trimmed.indexOf("=");
  if (equalIndex <= 0) {
    return null;
  }

  const key = trimmed.slice(0, equalIndex).trim();
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) {
    return null;
  }

  let value = trimmed.slice(equalIndex + 1).trim();
  if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
    value = value.slice(1, -1);
  }

  return { key, value };
}

function resolveProjectRoot(startDir = process.cwd()): string {
  let current = path.resolve(startDir);
  while (true) {
    if (fs.existsSync(path.join(current, "pnpm-workspace.yaml"))) {
      return current;
    }

    const next = path.dirname(current);
    if (next === current) {
      return startDir;
    }
    current = next;
  }
}

function parseEnvFile(filePath: string): Record<string, string> {
  const content = fs.readFileSync(filePath, "utf8");
  const entries: Record<string, string> = {};

  content.split(/\r?\n/g).forEach((line) => {
    const parsed = parseEnvLine(line);
    if (!parsed) {
      return;
    }
    entries[parsed.key] = parsed.value;
  });

  return entries;
}

export function loadProjectEnv(options?: { mode?: string; forceReload?: boolean }): void {
  const projectRoot = resolveProjectRoot();
  const mode = options?.mode ?? process.env.NODE_ENV ?? "development";
  const cacheKey = `${projectRoot}:${mode}`;
  if (!options?.forceReload && bootstrapped.has(cacheKey)) {
    return;
  }

  const files =
    mode === "test"
      ? [".env.test.local", ".env.test", ".env"]
      : [`.env.${mode}.local`, ".env.local", `.env.${mode}`, ".env"];

  files.forEach((filename) => {
    const fullPath = path.join(projectRoot, filename);
    if (!fs.existsSync(fullPath)) {
      return;
    }

    const values = parseEnvFile(fullPath);
    Object.entries(values).forEach(([key, value]) => {
      if (process.env[key] === undefined) {
        process.env[key] = value;
      }
    });
  });

  bootstrapped.add(cacheKey);
}
