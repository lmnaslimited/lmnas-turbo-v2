import path from "node:path";

export type ThemeFidelityMetric = {
  diffRatio: number;
  withinThreshold: boolean;
  durationMs: number;
};

export type ThemeFidelityRun = {
  themeKey: string;
  screenshotPath: string;
  metric: ThemeFidelityMetric;
};

export type ThemeFidelitySummary = {
  themeCount: number;
  failedThemes: string[];
  averageDiffRatio: number;
};

export type ThemeFidelityResult = {
  runs: ThemeFidelityRun[];
  summary: ThemeFidelitySummary;
};

export type ThemeCaptureOutput = {
  diffRatio: number;
  screenshotPath?: string;
};

export async function runThemeFidelity(input: {
  themes: string[];
  outputDir: string;
  threshold: number;
  captureTheme: (themeKey: string, screenshotPath: string) => Promise<ThemeCaptureOutput>;
  now?: () => number;
}): Promise<ThemeFidelityResult> {
  const themes = Array.from(new Set(input.themes.map((theme) => theme.trim()).filter((theme) => theme.length > 0))).sort((left, right) =>
    left.localeCompare(right)
  );

  const runs: ThemeFidelityRun[] = [];
  const now = input.now ?? (() => Date.now());

  for (const themeKey of themes) {
    const screenshotPath = buildThemeScreenshotPath(input.outputDir, themeKey);
    const startedAt = now();
    const capture = await input.captureTheme(themeKey, screenshotPath);
    const durationMs = Math.max(0, now() - startedAt);

    runs.push({
      themeKey,
      screenshotPath: capture.screenshotPath ?? screenshotPath,
      metric: {
        diffRatio: capture.diffRatio,
        withinThreshold: capture.diffRatio <= input.threshold,
        durationMs
      }
    });
  }

  const failedThemes = runs.filter((run) => !run.metric.withinThreshold).map((run) => run.themeKey);
  const averageDiffRatio =
    runs.length === 0
      ? 0
      : Number((runs.reduce((sum, run) => sum + run.metric.diffRatio, 0) / runs.length).toFixed(6));

  return {
    runs,
    summary: {
      themeCount: runs.length,
      failedThemes,
      averageDiffRatio
    }
  };
}

export function buildThemeScreenshotPath(outputDir: string, themeKey: string): string {
  return path.join(outputDir, `fidelity-${themeKey}.png`);
}
