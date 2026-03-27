import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { applyImportPlan, createImportPlan, stableStringify, type ApplyOptions, type PlanOptions } from "./index.js";
import type { ContentPlan } from "./contracts/contentPlan.schema.js";
import type { UpsertResult } from "./strapi/pageRepository.js";

type FlagValue = string | boolean;

export type OnboardFlags = Record<string, FlagValue>;

export type ResolvedOnboardOptions = {
  slug: string;
  locale: string;
  source: { kind: "url"; value: string } | { kind: "html"; value: string };
  outputPath: string;
  shouldApply: boolean;
};

export type OnboardDependencies = {
  cwd: () => string;
  createPlan: (options: PlanOptions) => Promise<ContentPlan>;
  applyPlan: (plan: unknown, options: ApplyOptions) => Promise<UpsertResult>;
  writeFile: typeof writeFile;
  mkdir: typeof mkdir;
  log: (line: string) => void;
};

export type OnboardExecutionResult = {
  planPath: string;
  applyExecuted: boolean;
  upsertResult?: UpsertResult;
};

const defaultDependencies: OnboardDependencies = {
  cwd: () => process.env.INIT_CWD ?? process.cwd(),
  createPlan: createImportPlan,
  applyPlan: applyImportPlan,
  writeFile,
  mkdir,
  log: (line) => console.log(line)
};

export function resolveOnboardOptions(flags: OnboardFlags, cwd: string): ResolvedOnboardOptions {
  const slug = typeof flags.slug === "string" ? flags.slug : undefined;
  const locale = typeof flags.locale === "string" ? flags.locale : undefined;

  if (!slug || !locale) {
    throw new Error("Missing required args: --slug, --locale");
  }

  const url = typeof flags.url === "string" ? flags.url : undefined;
  const html = typeof flags.html === "string" ? flags.html : undefined;

  if ((url && html) || (!url && !html)) {
    throw new Error("Provide exactly one of --url or --html");
  }

  const source = url ? ({ kind: "url", value: url } as const) : ({ kind: "html", value: html as string } as const);
  const outputPath =
    typeof flags.out === "string" && flags.out.trim().length > 0
      ? path.resolve(cwd, flags.out)
      : path.resolve(cwd, "docs", "import-plans", `${slug}.${locale}.json`);

  const apply = parseOptionalBoolean(flags.apply, "apply") === true;
  const explicitDryRun = parseOptionalBoolean(flags["dry-run"], "dry-run");

  const shouldApply = explicitDryRun === true ? false : apply;

  return {
    slug,
    locale,
    source,
    outputPath,
    shouldApply
  };
}

export async function executeOnboard(flags: OnboardFlags, overrides: Partial<OnboardDependencies> = {}): Promise<OnboardExecutionResult> {
  const deps: OnboardDependencies = {
    ...defaultDependencies,
    ...overrides
  };

  const cwd = deps.cwd();
  const resolved = resolveOnboardOptions(flags, cwd);

  const planOptions: PlanOptions = {
    slug: resolved.slug,
    locale: resolved.locale,
    ...(resolved.source.kind === "url" ? { url: resolved.source.value } : { html: resolved.source.value }),
    strapiUrl: typeof flags["strapi-url"] === "string" ? flags["strapi-url"] : undefined,
    strapiToken: typeof flags["strapi-token"] === "string" ? flags["strapi-token"] : undefined,
    graphqlPath: typeof flags["graphql-path"] === "string" ? flags["graphql-path"] : undefined
  };

  const plan = await deps.createPlan(planOptions);

  await deps.mkdir(path.dirname(resolved.outputPath), { recursive: true });
  await deps.writeFile(resolved.outputPath, stableStringify(plan), "utf8");

  deps.log("PLAN: generated");
  deps.log(`PLAN_PATH: ${toDisplayPath(resolved.outputPath, cwd)}`);

  if (!resolved.shouldApply) {
    deps.log("APPLY: skipped");
    deps.log(`UPSERT_RESULT: - ${plan.page.slug} unknown`);
    return {
      planPath: resolved.outputPath,
      applyExecuted: false
    };
  }

  try {
    const upsertResult = await deps.applyPlan(plan, {
      strapiUrl: typeof flags["strapi-url"] === "string" ? flags["strapi-url"] : undefined,
      strapiToken: typeof flags["strapi-token"] === "string" ? flags["strapi-token"] : undefined,
      graphqlPath: typeof flags["graphql-path"] === "string" ? flags["graphql-path"] : undefined,
      forceCreate: parseOptionalBoolean(flags["force-create"], "force-create") === true,
      forceUpdate: parseOptionalBoolean(flags["force-update"], "force-update") === true,
      forceReplace: parseOptionalBoolean(flags["force-replace"], "force-replace") === true,
      publishState: parseOptionalBoolean(flags.publish, "publish") === true ? "published" : "draft"
    });

    deps.log("APPLY: executed");
    deps.log(`UPSERT_RESULT: ${upsertResult.documentId ?? "-"} ${upsertResult.finalSlug} ${upsertResult.status}`);

    return {
      planPath: resolved.outputPath,
      applyExecuted: true,
      upsertResult
    };
  } catch (error) {
    throw new Error(formatApplyError(error));
  }
}

function parseOptionalBoolean(raw: FlagValue | undefined, name: string): boolean | undefined {
  if (raw === undefined) {
    return undefined;
  }
  if (typeof raw === "boolean") {
    return raw;
  }
  const normalized = raw.toLowerCase();
  if (normalized === "true") {
    return true;
  }
  if (normalized === "false") {
    return false;
  }
  throw new Error(`Invalid boolean value for --${name}: ${raw}. Use true or false.`);
}

function toDisplayPath(targetPath: string, cwd: string): string {
  const relative = path.relative(cwd, targetPath);
  if (!relative || (!relative.startsWith("..") && !path.isAbsolute(relative))) {
    return relative || ".";
  }
  return targetPath;
}

function formatApplyError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  const opMatch = message.match(/Operation\s+([A-Za-z0-9_]+)\s+failed/);
  const errorsMatch = message.match(/GraphQL errors:\s*(\[.*\])$/s);

  if (opMatch && errorsMatch) {
    try {
      const parsed = JSON.parse(errorsMatch[1]) as Array<{ message?: string; path?: Array<string | number> }>;
      const first = parsed[0] ?? {};
      const pathText = Array.isArray(first.path) && first.path.length > 0 ? first.path.join(".") : "(unknown)";
      return `Apply failed: operation=${opMatch[1]} message=${first.message ?? "unknown"} path=${pathText}`;
    } catch {
      return `Apply failed: operation=${opMatch[1]} message=${message}`;
    }
  }

  return `Apply failed: ${message}`;
}
