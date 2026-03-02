import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import type { ContentPlan } from "../contracts/contentPlan.schema.js";
import { buildThemeScopeClass } from "../import/themeTokens.js";
import { runThemeFidelity, type ThemeCaptureOutput, type ThemeFidelityRun } from "./themeRunner.js";

export const FIDELITY_DIFF_THRESHOLD = 0.005;
export const FIDELITY_VIEWPORT = {
  width: 1280,
  height: 720
} as const;

export type FidelityGateStatus = "pending" | "pass" | "fail" | "forced";

export type FidelitySummary = {
  themeCount: number;
  failedThemes: string[];
  averageDiffRatio: number;
  maxDiffRatio: number;
};

export type FidelityGateReport = {
  schemaVersion: "import-fidelity.v1";
  generatedAt: string;
  threshold: number;
  status: Exclude<FidelityGateStatus, "pending">;
  forced: boolean;
  artifactPath?: string;
  runs: ThemeFidelityRun[];
  summary: FidelitySummary;
};

export type FidelityApplyGateState = {
  status: "pass" | "forced";
  threshold: number;
  failedThemes: string[];
  artifactPath?: string;
};

export type ThemeCaptureInput = {
  themeKey: string;
  themeScopeClass: string;
  screenshotPath: string;
  viewport: {
    width: number;
    height: number;
  };
};

export function resolveFidelityThemes(plan: ContentPlan, explicitThemes: string[] = []): string[] {
  const fromInput = explicitThemes.map((theme) => theme.trim()).filter((theme) => theme.length > 0);
  const themeFromPlan = plan.source.theme?.themeKey ?? "default";

  return Array.from(new Set([themeFromPlan, ...fromInput])).sort((left, right) => left.localeCompare(right));
}

export function buildFidelityArtifactPath(outputDir: string, slug: string): string {
  const normalizedSlug = slug
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  const safeSlug = normalizedSlug.length > 0 ? normalizedSlug : "page";
  return path.join(outputDir, `fidelity-report-${safeSlug}.json`);
}

export function createPendingFidelityMetadata(outputDir: string, slug: string, threshold = FIDELITY_DIFF_THRESHOLD) {
  return {
    threshold,
    status: "pending" as const,
    artifactPath: buildFidelityArtifactPath(outputDir, slug)
  };
}

export async function runFidelityGate(input: {
  plan: ContentPlan;
  outputDir: string;
  captureTheme: (input: ThemeCaptureInput) => Promise<ThemeCaptureOutput>;
  themes?: string[];
  threshold?: number;
  force?: boolean;
  artifactPath?: string;
  now?: () => Date;
  nowMs?: () => number;
}): Promise<FidelityGateReport> {
  const threshold = input.threshold ?? FIDELITY_DIFF_THRESHOLD;
  const force = input.force === true;
  const themes = resolveFidelityThemes(input.plan, input.themes ?? []);

  const result = await runThemeFidelity({
    themes,
    outputDir: input.outputDir,
    threshold,
    now: input.nowMs,
    captureTheme: async (themeKey, screenshotPath) =>
      input.captureTheme({
        themeKey,
        themeScopeClass: buildThemeScopeClass(themeKey),
        screenshotPath,
        viewport: {
          width: FIDELITY_VIEWPORT.width,
          height: FIDELITY_VIEWPORT.height
        }
      })
  });

  const maxDiffRatio = result.runs.reduce((max, run) => (run.metric.diffRatio > max ? run.metric.diffRatio : max), 0);
  const hasFailures = result.summary.failedThemes.length > 0;

  const report: FidelityGateReport = {
    schemaVersion: "import-fidelity.v1",
    generatedAt: (input.now ?? (() => new Date()))().toISOString(),
    threshold,
    status: hasFailures ? (force ? "forced" : "fail") : "pass",
    forced: force,
    runs: result.runs,
    summary: {
      themeCount: result.summary.themeCount,
      failedThemes: result.summary.failedThemes,
      averageDiffRatio: result.summary.averageDiffRatio,
      maxDiffRatio: Number(maxDiffRatio.toFixed(6))
    }
  };

  const artifactPath = input.artifactPath ?? buildFidelityArtifactPath(input.outputDir, input.plan.page.slug);
  await writeFidelityReport(artifactPath, report);

  return {
    ...report,
    artifactPath
  };
}

export async function writeFidelityReport(filePath: string, report: FidelityGateReport): Promise<void> {
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, stableStringify(report), "utf8");
}

export function enforceFidelityGateForApply(
  plan: ContentPlan,
  options: { force?: boolean } = {}
): FidelityApplyGateState | undefined {
  const hasSnapshot = plan.blocks.some((block) => block.__component === "blocks.imported-dom-snapshot");
  if (!hasSnapshot) {
    return undefined;
  }

  const fidelity = plan.source.fidelity;
  if (!fidelity || !fidelity.summary) {
    if (options.force === true) {
      return {
        status: "forced",
        threshold: fidelity?.threshold ?? FIDELITY_DIFF_THRESHOLD,
        failedThemes: ["unverified"],
        artifactPath: fidelity?.artifactPath
      };
    }

    throw new Error(
      "[content-importer] fidelity gate missing report. Run `content-importer fidelity --plan <path> --baseline-url <url> --candidate-url <url>` or pass --force."
    );
  }

  const failedThemes = fidelity.summary.failedThemes;
  if (failedThemes.length > 0 && options.force !== true) {
    throw new Error(
      `[content-importer] fidelity gate failed threshold=${fidelity.threshold} failedThemes=${failedThemes.join(",")}. Re-run after fixes or pass --force.`
    );
  }

  return {
    status: failedThemes.length > 0 ? "forced" : "pass",
    threshold: fidelity.threshold,
    failedThemes,
    artifactPath: fidelity.artifactPath
  };
}

export function attachFidelityReportToPlan(plan: ContentPlan, report: FidelityGateReport): ContentPlan {
  return {
    ...plan,
    source: {
      ...plan.source,
      fidelity: {
        threshold: report.threshold,
        status: report.status,
        forced: report.forced,
        artifactPath: report.artifactPath,
        runs: report.runs,
        summary: report.summary
      }
    }
  };
}

function stableStringify(value: unknown): string {
  return `${JSON.stringify(sortKeys(value), null, 2)}\n`;
}

function sortKeys(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => sortKeys(item));
  }

  if (value && typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>).sort(([left], [right]) => left.localeCompare(right));
    return Object.fromEntries(entries.map(([key, item]) => [key, sortKeys(item)]));
  }

  return value;
}
