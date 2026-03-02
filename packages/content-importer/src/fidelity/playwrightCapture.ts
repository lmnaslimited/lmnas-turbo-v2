import { writeFile } from "node:fs/promises";

type BrowserLike = {
  newContext: (options: { viewport: { width: number; height: number } }) => Promise<BrowserContextLike>;
  close: () => Promise<void>;
};

type BrowserContextLike = {
  newPage: () => Promise<PageLike>;
  close: () => Promise<void>;
};

type PageLike = {
  goto: (url: string, options?: { waitUntil?: "load" | "domcontentloaded" | "networkidle" | "commit" }) => Promise<void>;
  evaluate: <TArg, TResult>(fn: (arg: TArg) => TResult | Promise<TResult>, arg: TArg) => Promise<TResult>;
  screenshot: (options?: { path?: string; fullPage?: boolean; type?: "png" | "jpeg" }) => Promise<Buffer>;
};

type ChromiumLike = {
  launch: () => Promise<BrowserLike>;
};

const dynamicImport = new Function("modulePath", "return import(modulePath);") as (modulePath: string) => Promise<unknown>;

export function createPlaywrightThemeCapture(input: {
  baselineUrl: string;
  candidateUrl: string;
  fullPage?: boolean;
}) {
  return async (params: {
    themeScopeClass: string;
    screenshotPath: string;
    viewport: {
      width: number;
      height: number;
    };
  }): Promise<{ diffRatio: number; screenshotPath: string }> => {
    const chromium = await loadChromium();
    const browser = await chromium.launch();

    try {
      const context = await browser.newContext({
        viewport: params.viewport
      });

      try {
        const baselinePage = await context.newPage();
        await baselinePage.goto(input.baselineUrl, { waitUntil: "networkidle" });
        await applyThemeClass(baselinePage, params.themeScopeClass);

        const baselinePath = buildBaselinePath(params.screenshotPath);
        const baselineBuffer = await baselinePage.screenshot({
          path: baselinePath,
          fullPage: input.fullPage,
          type: "png"
        });

        const candidatePage = await context.newPage();
        await candidatePage.goto(input.candidateUrl, { waitUntil: "networkidle" });
        await applyThemeClass(candidatePage, params.themeScopeClass);

        const candidateBuffer = await candidatePage.screenshot({
          path: params.screenshotPath,
          fullPage: input.fullPage,
          type: "png"
        });

        const diffRatio = await comparePngBuffers(candidatePage, baselineBuffer, candidateBuffer);
        await writeFile(buildDiffPath(params.screenshotPath), JSON.stringify({ diffRatio }, null, 2), "utf8");

        return {
          diffRatio,
          screenshotPath: params.screenshotPath
        };
      } finally {
        await context.close();
      }
    } finally {
      await browser.close();
    }
  };
}

async function loadChromium(): Promise<ChromiumLike> {
  const playwrightModule = await tryImportPlaywright("playwright");
  if (playwrightModule?.chromium) {
    return playwrightModule.chromium as ChromiumLike;
  }

  const playwrightCoreModule = await tryImportPlaywright("playwright-core");
  if (playwrightCoreModule?.chromium) {
    return playwrightCoreModule.chromium as ChromiumLike;
  }

  throw new Error(
    "Playwright is required for fidelity screenshots. Install `playwright` or `playwright-core` in the workspace before running `content-importer fidelity`."
  );
}

async function tryImportPlaywright(modulePath: string): Promise<Record<string, unknown> | null> {
  try {
    const loaded = await dynamicImport(modulePath);
    if (!loaded || typeof loaded !== "object") {
      return null;
    }

    return loaded as Record<string, unknown>;
  } catch {
    return null;
  }
}

async function applyThemeClass(page: PageLike, themeScopeClass: string): Promise<void> {
  await page.evaluate(({ className }) => {
    document.documentElement.classList.add(className);
    document.body.classList.add(className);
  }, { className: themeScopeClass });
}

async function comparePngBuffers(page: PageLike, baselineBuffer: Buffer, candidateBuffer: Buffer): Promise<number> {
  const diffRatio = await page.evaluate(
    async (payload) => {
      const loadImage = async (dataUrl: string) => {
        const image = new Image();
        image.src = dataUrl;

        await new Promise<void>((resolve, reject) => {
          image.onload = () => resolve();
          image.onerror = () => reject(new Error("Failed to decode screenshot"));
        });

        const canvas = document.createElement("canvas");
        canvas.width = image.width;
        canvas.height = image.height;

        const context = canvas.getContext("2d");
        if (!context) {
          throw new Error("Missing 2d canvas context");
        }

        context.drawImage(image, 0, 0);
        return context.getImageData(0, 0, image.width, image.height);
      };

      const baseline = await loadImage(payload.baselineDataUrl);
      const candidate = await loadImage(payload.candidateDataUrl);

      if (baseline.width !== candidate.width || baseline.height !== candidate.height) {
        return 1;
      }

      const totalPixels = baseline.width * baseline.height;
      if (totalPixels === 0) {
        return 0;
      }

      let differingPixels = 0;
      for (let index = 0; index < baseline.data.length; index += 4) {
        const samePixel =
          baseline.data[index] === candidate.data[index] &&
          baseline.data[index + 1] === candidate.data[index + 1] &&
          baseline.data[index + 2] === candidate.data[index + 2] &&
          baseline.data[index + 3] === candidate.data[index + 3];

        if (!samePixel) {
          differingPixels += 1;
        }
      }

      return Number((differingPixels / totalPixels).toFixed(6));
    },
    {
      baselineDataUrl: `data:image/png;base64,${baselineBuffer.toString("base64")}`,
      candidateDataUrl: `data:image/png;base64,${candidateBuffer.toString("base64")}`
    }
  );

  return diffRatio;
}

function buildBaselinePath(screenshotPath: string): string {
  return screenshotPath.replace(/fidelity-/, "baseline-");
}

function buildDiffPath(screenshotPath: string): string {
  return screenshotPath.replace(/\.png$/i, ".diff.json");
}
