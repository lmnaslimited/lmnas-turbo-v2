#!/usr/bin/env node
import { readFile, writeFile } from "node:fs/promises";
import { applyImportPlan, createImportPlan, stableStringify } from "./index";

function parseArgs(argv: string[]): { command?: string; flags: Record<string, string | boolean> } {
  const [command, ...rest] = argv;
  const flags: Record<string, string | boolean> = {};

  for (let i = 0; i < rest.length; i += 1) {
    const token = rest[i];
    if (!token.startsWith("--")) {
      continue;
    }
    const key = token.slice(2);
    const next = rest[i + 1];
    if (!next || next.startsWith("--")) {
      flags[key] = true;
      continue;
    }
    flags[key] = next;
    i += 1;
  }

  return { command, flags };
}

async function runPlan(flags: Record<string, string | boolean>): Promise<void> {
  const url = typeof flags.url === "string" ? flags.url : undefined;
  const htmlPath = typeof flags.html === "string" ? flags.html : undefined;
  const slug = typeof flags.slug === "string" ? flags.slug : undefined;
  const locale = typeof flags.locale === "string" ? flags.locale : undefined;
  const out = typeof flags.out === "string" ? flags.out : undefined;

  if (!slug || !locale || !out) {
    throw new Error("Missing required args: --slug, --locale, --out");
  }

  const plan = await createImportPlan({ url, htmlPath, slug, locale });
  await writeFile(out, stableStringify(plan), "utf8");
}

async function runApply(flags: Record<string, string | boolean>): Promise<void> {
  const planPath = typeof flags.plan === "string" ? flags.plan : undefined;
  if (!planPath) {
    throw new Error("Missing required arg: --plan");
  }

  const raw = await readFile(planPath, "utf8");
  const plan = JSON.parse(raw) as unknown;
  await applyImportPlan(plan as never, {});
}

async function main(): Promise<void> {
  const { command, flags } = parseArgs(process.argv.slice(2));

  if (command === "plan") {
    await runPlan(flags);
    return;
  }

  if (command === "apply") {
    await runApply(flags);
    return;
  }

  throw new Error("Usage: content-importer <plan|apply> [--flags]");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
