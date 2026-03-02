#!/usr/bin/env node
import path from "node:path";
import { writeFile } from "node:fs/promises";
import { applyImportPlan, createImportPlan, stableStringify, validatePlanFile } from "./index.js";
import { attachFidelityReportToPlan, buildFidelityArtifactPath, FIDELITY_DIFF_THRESHOLD, runFidelityGate } from "./fidelity/gate.js";
import { createPlaywrightThemeCapture } from "./fidelity/playwrightCapture.js";
import { executeOnboard } from "./onboard.js";
import { preflight } from "./strapi/graphqlClient.js";
import { generateSchemaArtifacts } from "./strapi/schema/runSchema.js";
import { deriveSchemaFacts, formatSchemaFacts } from "./strapi/schema/facts.js";
import { readIntrospectionFromDisk } from "./strapi/schema/introspection.js";

function parseArgs(argv: string[]): { command?: string; flags: Record<string, string | boolean> } {
  const [command, ...rest] = argv;
  const flags: Record<string, string | boolean> = {};

  for (let i = 0; i < rest.length; i += 1) {
    const token = rest[i];
    if (token === "--" || !token.startsWith("--")) {
      continue;
    }

    const eqIndex = token.indexOf("=");
    if (eqIndex > 2) {
      const key = token.slice(2, eqIndex);
      const value = token.slice(eqIndex + 1);
      flags[key] = value.length > 0 ? value : true;
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

function resolveEnv(flags: Record<string, string | boolean>) {
  const strapiUrl = typeof flags["strapi-url"] === "string" ? flags["strapi-url"] : process.env.STRAPI_URL;
  const strapiToken = typeof flags["strapi-token"] === "string" ? flags["strapi-token"] : process.env.STRAPI_TOKEN;
  const graphqlPath =
    typeof flags["graphql-path"] === "string" ? flags["graphql-path"] : process.env.STRAPI_GRAPHQL_PATH ?? "/graphql";

  return {
    strapiUrl,
    strapiToken,
    graphqlPath
  };
}

async function runSchema(flags: Record<string, string | boolean>): Promise<void> {
  const env = resolveEnv(flags);
  if (!env.strapiUrl || !env.strapiToken) {
    throw new Error("Missing STRAPI_URL or STRAPI_TOKEN.");
  }

  await preflight({ strapiUrl: env.strapiUrl, token: env.strapiToken, graphqlPath: env.graphqlPath });
  await generateSchemaArtifacts({
    strapiUrl: env.strapiUrl,
    strapiToken: env.strapiToken,
    graphqlPath: env.graphqlPath,
    rootDir: process.cwd(),
    debugSchema: flags["debug-schema"] === true
  });
}

async function runSchemaFacts(): Promise<void> {
  const payload = await readIntrospectionFromDisk(process.cwd());
  const facts = deriveSchemaFacts(payload);
  console.log(formatSchemaFacts(facts));
}

async function runPlan(flags: Record<string, string | boolean>): Promise<void> {
  const slug = typeof flags.slug === "string" ? flags.slug : undefined;
  const locale = typeof flags.locale === "string" ? flags.locale : undefined;
  const out = typeof flags.out === "string" ? flags.out : undefined;
  const url = typeof flags.url === "string" ? flags.url : undefined;
  const html = typeof flags.html === "string" ? flags.html : undefined;
  const theme = typeof flags.theme === "string" ? flags.theme : undefined;
  const statusFlag = typeof flags.status === "string" ? flags.status.toUpperCase() : undefined;
  const status = statusFlag === "DRAFT" || statusFlag === "PUBLISHED" ? statusFlag : undefined;
  const env = resolveEnv(flags);

  if (!slug || !locale || !out) {
    throw new Error("Missing required args: --slug, --locale, --out");
  }

  const plan = await createImportPlan({
    slug,
    locale,
    url,
    html,
    theme,
    status,
    strapiUrl: env.strapiUrl,
    strapiToken: env.strapiToken,
    graphqlPath: env.graphqlPath
  });

  await writeFile(out, stableStringify(plan), "utf8");
}

async function runValidatePlan(flags: Record<string, string | boolean>): Promise<void> {
  const planPath = typeof flags.plan === "string" ? flags.plan : undefined;
  if (!planPath) {
    throw new Error("Missing required arg: --plan");
  }

  try {
    await validatePlanFile(planPath);
    console.log(`Plan is valid: ${planPath}`);
  } catch (error) {
    if (error instanceof Error && "issues" in error) {
      const maybeIssues = (error as { issues?: Array<{ path?: Array<string | number>; message?: string }> }).issues;
      if (Array.isArray(maybeIssues)) {
        const summary = maybeIssues
          .map((issue) => {
            const path = issue.path?.join(".") || "(root)";
            return `${path}: ${issue.message}`;
          })
          .join("\n");
        throw new Error(`Plan validation failed:\n${summary}`);
      }
    }
    throw error;
  }
}

async function runApply(flags: Record<string, string | boolean>): Promise<void> {
  const planPath = typeof flags.plan === "string" ? flags.plan : undefined;
  const env = resolveEnv(flags);
  const forceCreate = flags["force-create"] === true;
  const forceUpdate = flags["force-update"] === true;
  const forceReplace = flags["force-replace"] === true;
  const strictUpsert = flags["strict-upsert"] === true;
  const forceFidelity = flags.force === true;
  const publishState = flags.publish === true ? "published" : "draft";

  if (!planPath) {
    throw new Error("Missing required arg: --plan");
  }

  const plan = await validatePlanFile(planPath);
  const result = await applyImportPlan(plan, {
    strapiUrl: env.strapiUrl,
    strapiToken: env.strapiToken,
    graphqlPath: env.graphqlPath,
    forceCreate,
    forceUpdate,
    forceReplace,
    strictUpsert,
    publishState,
    forceFidelity
  });

  const fidelitySummary = result.fidelityGate
    ? ` fidelity=${result.fidelityGate.status} threshold=${result.fidelityGate.threshold} failedThemes=${result.fidelityGate.failedThemes.join(",") || "none"}`
    : " fidelity=skipped";

  console.log(
    `[content-importer] apply complete mode=${result.mode} action=${result.action} existing=${result.existing.found ? "yes" : "no"} publishState=${publishState} finalSlug=${result.finalSlug}${fidelitySummary}`
  );
}

async function runOnboard(flags: Record<string, string | boolean>): Promise<void> {
  await executeOnboard(flags);
}

async function runFidelity(flags: Record<string, string | boolean>): Promise<void> {
  const planPath = typeof flags.plan === "string" ? flags.plan : undefined;
  const baselineUrl = typeof flags["baseline-url"] === "string" ? flags["baseline-url"] : undefined;
  const candidateUrl = typeof flags["candidate-url"] === "string" ? flags["candidate-url"] : undefined;

  if (!planPath || !baselineUrl || !candidateUrl) {
    throw new Error("Missing required args: --plan, --baseline-url, --candidate-url");
  }

  const outPlanPath = typeof flags.out === "string" ? flags.out : planPath;
  const outDir = typeof flags["out-dir"] === "string" ? flags["out-dir"] : path.dirname(outPlanPath);
  const threshold = parseThresholdFlag(flags.threshold);
  const force = flags.force === true;
  const themes = parseThemesFlag(flags.themes);
  const fullPage = flags["full-page"] === true;

  const plan = await validatePlanFile(planPath);
  const report = await runFidelityGate({
    plan,
    outputDir: outDir,
    themes,
    threshold,
    force,
    artifactPath: buildFidelityArtifactPath(outDir, plan.page.slug),
    captureTheme: createPlaywrightThemeCapture({
      baselineUrl,
      candidateUrl,
      fullPage
    })
  });

  const updatedPlan = attachFidelityReportToPlan(plan, report);
  await writeFile(outPlanPath, stableStringify(updatedPlan), "utf8");

  console.log(
    `[content-importer] fidelity ${report.status.toUpperCase()} threshold=${report.threshold} failedThemes=${report.summary.failedThemes.join(",") || "none"} artifact=${report.artifactPath}`
  );

  if (report.status === "fail") {
    throw new Error("[content-importer] fidelity gate failed; re-run with --force to override.");
  }
}

function parseThemesFlag(value: string | boolean | undefined): string[] {
  if (typeof value !== "string") {
    return [];
  }

  return value
    .split(",")
    .map((theme) => theme.trim())
    .filter((theme) => theme.length > 0);
}

function parseThresholdFlag(value: string | boolean | undefined): number {
  if (typeof value !== "string") {
    return FIDELITY_DIFF_THRESHOLD;
  }

  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0 || parsed > 1) {
    throw new Error(`Invalid --threshold value: ${value}`);
  }

  return parsed;
}

async function main(): Promise<void> {
  const { command, flags } = parseArgs(process.argv.slice(2));

  if (command === "schema") {
    await runSchema(flags);
    return;
  }

  if (command === "schema:facts") {
    await runSchemaFacts();
    return;
  }

  if (command === "plan") {
    await runPlan(flags);
    return;
  }

  if (command === "validate-plan") {
    await runValidatePlan(flags);
    return;
  }

  if (command === "apply") {
    await runApply(flags);
    return;
  }

  if (command === "fidelity") {
    await runFidelity(flags);
    return;
  }

  if (command === "onboard") {
    await runOnboard(flags);
    return;
  }

  throw new Error("Usage: content-importer <schema|schema:facts|plan|validate-plan|apply|fidelity|onboard> [--flags]");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
