import { describe, expect, it, vi, afterEach } from "vitest";
import { createCanonicalBlockSnapshot } from "../../../../lib/studio-canonical";
import type { StudioBlockTemplate, StudioPageDocument, StudioShell, StudioTheme } from "./studio-types";
import {
  buildCanonicalCssVarsBlock,
  buildPlatformBlockPreviewDocument,
  buildPlatformPagePreviewDocument,
  buildPlatformTargetDocument,
  canonicalizeBlockOrder,
  classifyStylesheetHref,
  createStaticPlatformPreviewAssets,
  extractSourceTailwindConfig,
  KNOWN_TAILWIND_PLUGINS,
  sanitizeTargetHtml,
  TAILWIND_CDN_BLOCKLIST_PATTERNS
} from "./platform-preview-shared";
import {
  filterSourceStylesheetsByUrl,
  readManifestAssetList,
  resolveProposalTargetPreviewHtml
} from "./import-page-helpers";

function buildTheme(overrides: Partial<StudioTheme> = {}): StudioTheme {
  return {
    id: "theme-sunrise",
    themeKey: "sunrise",
    name: "Sunrise",
    status: "active",
    sourceRef: "test",
    createdAt: "2026-03-14",
    updatedAt: "2026-03-14",
    tokenCoverage: 1,
    themeDebt: "none",
    darkMode: false,
    tokens: [
      { key: "primary", label: "Primary", category: "color", value: "#ff4f00", cssVariable: "--color-primary", mapped: true },
      {
        key: "background-light",
        label: "Background Light",
        category: "color",
        value: "#fff6e9",
        cssVariable: "--background-light",
        mapped: true
      },
      {
        key: "background-dark",
        label: "Background Dark",
        category: "color",
        value: "#1f0d05",
        cssVariable: "--background-dark",
        mapped: true
      },
      {
        key: "foreground",
        label: "Foreground",
        category: "color",
        value: "#2b1207",
        cssVariable: "--foreground",
        mapped: true
      },
      {
        key: "font-display",
        label: "Display Font",
        category: "typography",
        value: "Fraunces, serif",
        cssVariable: "--font-display",
        mapped: true
      }
    ],
    ...overrides
  };
}

function buildBlock(overrides: Partial<StudioBlockTemplate> = {}): StudioBlockTemplate {
  const snapshot = createCanonicalBlockSnapshot({
    html: "<section class=\"bg-background-light text-primary\"><h1>Target Hero</h1></section>",
    sourceUrl: "https://source.example/landing",
    themeScopeClass: "theme-sunrise",
    stylesheetRef: "/studio-runtime.css"
  });
  return {
    id: "block-doc-1",
    key: "import-source-stable-01",
    name: "Imported Hero",
    blockType: snapshot.blockType,
    family: "hero",
    status: "active",
    lifecycle: "draft",
    scope: "global",
    schemaStatus: "valid",
    themeKey: "sunrise",
    sourceType: "test",
    sourceRef: "docs/testing-artifacts/code.html",
    domJson: snapshot.domJson,
    classMap: snapshot.classMap,
    stylesheetRef: snapshot.stylesheetRef,
    confidence: 0.9,
    editableFields: [],
    actions: [],
    previewHtml: "",
    targetPreviewHtml: "",
    inUseCount: 0,
    usageCount: 0,
    createdAt: "2026-03-14",
    updatedAt: "2026-03-14",
    ...overrides
  };
}

function buildPage(overrides: Partial<StudioPageDocument> = {}): StudioPageDocument {
  return {
    id: "page-1",
    name: "Landing Page",
    slug: "landing-page",
    locale: "en",
    shellKey: "shell-main",
    themeKey: "sunrise",
    lifecycle: "draft",
    status: "draft",
    blockOrder: ["import-source-stable-01"],
    fieldValues: {},
    actionOverrides: {},
    productMapping: "lens-ai-revenue-platform",
    industryMapping: ["enterprise"],
    primaryCta: { text: "Book Demo", url: "/contact" },
    conversionConfig: { trackConversions: true, strategy: "Track Conversions", valuePoints: 10 },
    campaignUtmStrategy: { source: "lmnas", medium: "studio", campaign: "preview-shared-test" },
    taxonomyState: { valid: true, tags: ["enterprise"] },
    seoMetadata: { metaTitle: "Landing Page", metaDescription: "Landing Page" },
    seoJsonLdValid: true,
    blockSchemaValid: true,
    previewValid: true,
    previewHtml: "<main><section>Fallback Preview</section></main>",
    updatedAt: "2026-03-14",
    ...overrides
  };
}

const shells: StudioShell[] = [
  {
    id: "shell-main",
    key: "shell-main",
    name: "Main Shell",
    role: "full",
    status: "active",
    updatedAt: "2026-03-14",
    menuItems: [],
    actions: [],
    navbarBlocks: [],
    footerBlocks: [],
    previewHtml: "<header><nav>Main Shell</nav></header>"
  }
];

describe("platform preview shared helpers", () => {
  it("builds block previews with platform css and selected theme runtime config without page shells", () => {
    const html = buildPlatformBlockPreviewDocument({
      proposalHtml: "<section class=\"bg-background-light text-primary font-display\"><h1>Hero</h1></section>",
      theme: buildTheme(),
      hostAssets: createStaticPlatformPreviewAssets("http://localhost:3000")
    });

    expect(html).toContain("lmnas-preview-tailwind-config");
    expect(html).toContain("http://localhost:3000/studio-runtime.css");
    expect(html).toContain("#ff4f00");
    expect(html).toContain("#fff6e9");
    expect(html).toContain("Fraunces");
    expect(html).toContain("bg-background-light");
    expect(html).toContain("text-primary");
    expect(html.match(/<div class="lmnas-preview-shell">/g) ?? []).toHaveLength(0);
  });

  it("canonicalizes legacy block ids and renders page previews through the same shared pipeline", () => {
    const theme = buildTheme();
    const legacyReferencedBlock = buildBlock();
    const page = buildPage({
      blockOrder: ["block-doc-1"]
    });

    expect(canonicalizeBlockOrder(page.blockOrder, [legacyReferencedBlock])).toEqual(["import-source-stable-01"]);

    const html = buildPlatformPagePreviewDocument({
      page,
      blocks: [legacyReferencedBlock],
      shells,
      themes: [theme],
      hostAssets: createStaticPlatformPreviewAssets("http://localhost:3000")
    });

    expect(html).toContain("Main Shell");
    expect(html).toContain("Target Hero");
    expect(html).toContain("lmnas-preview-tailwind-config");
    expect(html).toContain("http://localhost:3000/studio-runtime.css");
    expect(html).not.toContain("Fallback Preview");
  });

  it("rebuilds empty page previews from canonical state instead of reviving old fallback content", () => {
    const html = buildPlatformPagePreviewDocument({
      page: buildPage({
        blockOrder: [],
        previewHtml: "<main><section>Old Snapshot</section></main>"
      }),
      blocks: [buildBlock()],
      shells,
      themes: [buildTheme()],
      hostAssets: createStaticPlatformPreviewAssets("http://localhost:3000")
    });

    expect(html).toContain("No blocks composed yet.");
    expect(html).not.toContain("Old Snapshot");
    expect(html.match(/Main Shell/g) ?? []).toHaveLength(1);
  });

  it("regenerates page previews from canonical snapshots after disposable preview cache removal", () => {
    const html = buildPlatformPagePreviewDocument({
      page: buildPage({
        previewHtml: "",
        publishedPreviewHtml: undefined
      }),
      blocks: [
        buildBlock({
          previewHtml: "",
          sourcePreviewHtml: "",
          targetPreviewHtml: ""
        })
      ],
      shells,
      themes: [buildTheme()],
      hostAssets: createStaticPlatformPreviewAssets("https://preview.example")
    });

    expect(html).toContain("Target Hero");
    expect(html).toContain("https://preview.example/studio-runtime.css");
    expect(html).not.toContain("No preview available");
  });

  it("changes derived preview styling when canonical theme tokens change", () => {
    const warmHtml = buildPlatformBlockPreviewDocument({
      proposalHtml: "<section class=\"bg-background-light text-primary font-display\"><h1>Hero</h1></section>",
      theme: buildTheme(),
      hostAssets: createStaticPlatformPreviewAssets("https://preview.example")
    });
    const coolHtml = buildPlatformBlockPreviewDocument({
      proposalHtml: "<section class=\"bg-background-light text-primary font-display\"><h1>Hero</h1></section>",
      theme: buildTheme({
        id: "theme-cool",
        themeKey: "cool",
        themeScopeClass: "theme-cool",
        tokens: [
          { key: "primary", label: "Primary", category: "color", value: "#0057ff", cssVariable: "--color-primary", mapped: true },
          {
            key: "background-light",
            label: "Background Light",
            category: "color",
            value: "#ecf5ff",
            cssVariable: "--background-light",
            mapped: true
          },
          {
            key: "background-dark",
            label: "Background Dark",
            category: "color",
            value: "#07162f",
            cssVariable: "--background-dark",
            mapped: true
          },
          {
            key: "foreground",
            label: "Foreground",
            category: "color",
            value: "#04204d",
            cssVariable: "--foreground",
            mapped: true
          },
          {
            key: "font-display",
            label: "Display Font",
            category: "typography",
            value: "IBM Plex Sans, sans-serif",
            cssVariable: "--font-display",
            mapped: true
          }
        ]
      }),
      hostAssets: createStaticPlatformPreviewAssets("https://preview.example")
    });

    expect(warmHtml).toContain("#ff4f00");
    expect(coolHtml).toContain("#0057ff");
    expect(warmHtml).not.toEqual(coolHtml);
  });
});

// ---------------------------------------------------------------------------
// Step 1: classifyStylesheetHref
// ---------------------------------------------------------------------------

describe("Step 1 — classifyStylesheetHref", () => {
  it("blocks all known Tailwind CDN patterns", () => {
    const cdnUrls = [
      "https://cdn.tailwindcss.com",
      "https://cdn.tailwindcss.com?plugins=forms",
      "https://esm.sh/@tailwindcss/browser",
      "https://example.com/tailwind.min.css",
      "https://example.com/tailwind.css",
      "https://my-app.com/studio-runtime.css"
    ];
    for (const url of cdnUrls) {
      expect(classifyStylesheetHref(url), `Expected block for: ${url}`).toBe("block");
    }
  });

  it("allows non-CDN stylesheet URLs", () => {
    const allowedUrls = [
      "https://fonts.googleapis.com/css2?family=Inter",
      "https://source.example.com/globals.css",
      "/styles/custom-reset.css",
      "https://myapp.com/tokens.css"
    ];
    for (const url of allowedUrls) {
      expect(classifyStylesheetHref(url), `Expected allow for: ${url}`).toBe("allow");
    }
  });

  it("blocks hrefs matching additional caller-supplied patterns", () => {
    expect(
      classifyStylesheetHref("https://preview.example.com/studio-runtime.css", ["/studio-runtime.css"])
    ).toBe("block");
  });

  it("is case-insensitive", () => {
    expect(classifyStylesheetHref("https://CDN.TAILWINDCSS.COM")).toBe("block");
    expect(classifyStylesheetHref("https://FOO.COM/GLOBALS.CSS")).toBe("allow");
  });

  it("TAILWIND_CDN_BLOCKLIST_PATTERNS is non-empty", () => {
    expect(TAILWIND_CDN_BLOCKLIST_PATTERNS.length).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// Step 1: sanitizeTargetHtml (selective stripping)
// ---------------------------------------------------------------------------

describe("Step 1 — sanitizeTargetHtml selective stripping", () => {
  it("strips CDN tailwind link tags but keeps allowed stylesheets", () => {
    const input = `<html><head>
      <link rel="stylesheet" href="https://cdn.tailwindcss.com">
      <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter">
    </head><body><section><p>Hello</p></section></body></html>`;
    const result = sanitizeTargetHtml(input);
    expect(result).not.toContain("cdn.tailwindcss.com");
  });

  it("strips tailwind.config script blocks from body", () => {
    const input = `<html><body>
      <script id="tailwind-config">window.tailwind = {};</script>
      <section><h1>Hello</h1></section>
    </body></html>`;
    const result = sanitizeTargetHtml(input);
    expect(result).not.toContain("tailwind-config");
    expect(result).toContain("<h1>Hello</h1>");
  });

  it("returns body content without wrapper html/head tags", () => {
    const result = sanitizeTargetHtml("<section><h2>Block</h2></section>");
    expect(result).toContain("<section>");
    expect(result).not.toContain("<html>");
    expect(result).not.toContain("<head>");
  });
});

// ---------------------------------------------------------------------------
// Step 2: extractSourceTailwindConfig
// ---------------------------------------------------------------------------

describe("Step 2 — extractSourceTailwindConfig", () => {
  it("returns {} for empty input", () => {
    expect(extractSourceTailwindConfig("")).toEqual({});
    expect(extractSourceTailwindConfig("   ")).toEqual({});
  });

  it("extracts config from <script id='tailwind-config'> block", () => {
    const html = `<script id="tailwind-config">
      { darkMode: "class", theme: { extend: { colors: { brand: "#abc123" } } } }
    </script>`;
    const config = extractSourceTailwindConfig(html);
    expect(config["darkMode"]).toBe("class");
    expect((config["theme"] as Record<string, unknown>)?.["extend"]).toBeDefined();
  });

  it("extracts config from window.tailwind.config = {...}", () => {
    const html = `<script>
      window.tailwind = window.tailwind || {};
      window.tailwind.config = { darkMode: "media", theme: { extend: { fontFamily: { sans: ["Inter"] } } } };
    </script>`;
    const config = extractSourceTailwindConfig(html);
    expect(config["darkMode"]).toBe("media");
  });

  it("returns {} when no config found", () => {
    expect(extractSourceTailwindConfig("<html><body>no config</body></html>")).toEqual({});
  });

  it("returns {} on malformed JS", () => {
    const html = `<script id="tailwind-config">this is broken { }</script>`;
    expect(extractSourceTailwindConfig(html)).toEqual({});
  });

  it("handles complex config shapes with plugins", () => {
    const html = `<script id="tailwind-config">
      {
        darkMode: "class",
        plugins: ["typography", "forms"],
        theme: { screens: { "2xl": "1440px" }, extend: { colors: { coral: "#ff6b6b" } } }
      }
    </script>`;
    const config = extractSourceTailwindConfig(html);
    expect(config["plugins"]).toEqual(["typography", "forms"]);
  });
});

// ---------------------------------------------------------------------------
// Step 2: buildCanonicalCssVarsBlock
// ---------------------------------------------------------------------------

describe("Step 2 — buildCanonicalCssVarsBlock", () => {
  it("returns a <style id='lmnas-canonical-vars'> block", () => {
    const result = buildCanonicalCssVarsBlock(buildThemeImport());
    expect(result).toContain(`id="lmnas-canonical-vars"`);
    expect(result).toContain("<style");
    expect(result).toContain("</style>");
    expect(result).toContain(":root{");
  });

  it("contains canonical primary color from StudioTheme tokens", () => {
    const result = buildCanonicalCssVarsBlock(buildThemeImport());
    expect(result).toContain("#ff4f00");
  });

  it("maps color tokens to --color-* namespace for Tailwind v4 utility compatibility", () => {
    const result = buildCanonicalCssVarsBlock(buildThemeImport());
    expect(result).toContain("--color-primary");
    expect(result).toContain("--color-background-light");
  });

  it("changes output when theme tokens change", () => {
    const warm = buildCanonicalCssVarsBlock(buildThemeImport());
    const cool = buildCanonicalCssVarsBlock(buildThemeImport({
      tokens: [{ key: "primary", label: "Primary", category: "color", value: "#0057ff", cssVariable: "--color-primary", mapped: true }]
    }));
    expect(warm).toContain("#ff4f00");
    expect(cool).toContain("#0057ff");
    expect(warm).not.toEqual(cool);
  });

  it("returns empty string for null theme", () => {
    expect(buildCanonicalCssVarsBlock(null)).toBe("");
  });

  it("does NOT contain window.tailwind.config", () => {
    const result = buildCanonicalCssVarsBlock(buildThemeImport());
    expect(result).not.toContain("window.tailwind");
    expect(result).not.toContain("tailwind.config");
  });
});

// ---------------------------------------------------------------------------
// Step 3: buildPlatformTargetDocument — CDN-free assertions
// ---------------------------------------------------------------------------

describe("Step 3 — buildPlatformTargetDocument (CDN-free mode)", () => {
  afterEach(() => { vi.restoreAllMocks(); });

  it("uses <link> to platformCssSrc instead of CDN script when platformCssSrc is set", () => {
    const hostAssets = { headMarkup: "", tailwindRuntimeSrc: null, platformCssSrc: "http://localhost:5173/src/style.css" };
    const html = buildPlatformTargetDocument({
      bodyHtml: "<div>test</div>",
      theme: buildThemeImport(),
      hostAssets
    });
    expect(html).toContain(`href="http://localhost:5173/src/style.css"`);
    expect(html).not.toContain(`<script src="https://cdn.tailwindcss.com`);
    expect(html).not.toContain("window.tailwind.config");
  });

  it("canonical vars block is at end of body (CDN-free)", () => {
    const hostAssets = { headMarkup: "", tailwindRuntimeSrc: null, platformCssSrc: "http://localhost:5173/src/style.css" };
    const html = buildPlatformTargetDocument({
      bodyHtml: "<div>test</div>",
      theme: buildThemeImport(),
      hostAssets
    });
    const varsIndex = html.indexOf("lmnas-canonical-vars");
    const bodyCloseIndex = html.indexOf("</body>");
    expect(varsIndex).toBeGreaterThan(0);
    expect(varsIndex).toBeLessThan(bodyCloseIndex);
  });

  it("logs console.warn for unknown plugins as theme debt", () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    buildPlatformTargetDocument({
      bodyHtml: "<div>test</div>",
      theme: buildThemeImport(),
      hostAssets: { headMarkup: "", tailwindRuntimeSrc: null, platformCssSrc: "http://localhost:5173/src/style.css" },
      sourceTailwindConfig: { plugins: ["my-custom-plugin-xyz"] }
    });
    expect(warnSpy).toHaveBeenCalledOnce();
    expect(warnSpy.mock.calls[0]?.[0]).toContain("my-custom-plugin-xyz");
    expect(warnSpy.mock.calls[0]?.[0]).toContain("Theme debt");
  });

  it("does NOT warn for known plugins (pre-compiled)", () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    buildPlatformTargetDocument({
      bodyHtml: "<div>test</div>",
      theme: buildThemeImport(),
      hostAssets: { headMarkup: "", tailwindRuntimeSrc: null, platformCssSrc: "http://localhost:5173/src/style.css" },
      sourceTailwindConfig: { plugins: ["typography", "forms"] }
    });
    expect(warnSpy).not.toHaveBeenCalled();
  });

  it("KNOWN_TAILWIND_PLUGINS covers the 4 official first-party plugins", () => {
    for (const name of ["typography", "forms", "container-queries", "aspect-ratio"]) {
      expect(KNOWN_TAILWIND_PLUGINS.has(name), `Missing: ${name}`).toBe(true);
    }
  });
});

// ---------------------------------------------------------------------------
// Step 1: filterSourceStylesheetsByUrl + readManifestAssetList
// ---------------------------------------------------------------------------

describe("Step 1 — filterSourceStylesheetsByUrl", () => {
  it("excludes CDN tailwind, preserves others", () => {
    const hrefs = [
      "https://cdn.tailwindcss.com",
      "https://source.example.com/globals.css",
      "https://fonts.googleapis.com/css2?family=Inter"
    ];
    const result = filterSourceStylesheetsByUrl(hrefs);
    expect(result).not.toContain("https://cdn.tailwindcss.com");
    expect(result).toContain("https://source.example.com/globals.css");
    expect(result).toContain("https://fonts.googleapis.com/css2?family=Inter");
  });

  it("additionally blocks runtimeSrc when provided", () => {
    const hrefs = ["https://host.example.com/platform.css", "https://source.example.com/reset.css"];
    const result = filterSourceStylesheetsByUrl(hrefs, "https://host.example.com/platform.css");
    expect(result).not.toContain("https://host.example.com/platform.css");
    expect(result).toContain("https://source.example.com/reset.css");
  });
});

describe("readManifestAssetList", () => {
  it("reads stylesheets from a manifest with string values", () => {
    const manifest = { stylesheets: ["https://source.example.com/globals.css"] };
    const result = readManifestAssetList(manifest, "stylesheets");
    expect(result).toContain("https://source.example.com/globals.css");
  });

  it("reads stylesheets from manifest with object entries (href/src/url)", () => {
    const manifest = { stylesheets: [{ href: "https://source.example.com/globals.css" }] };
    const result = readManifestAssetList(manifest, "stylesheets");
    expect(result).toContain("https://source.example.com/globals.css");
  });

  it("returns [] for null/undefined/non-array", () => {
    expect(readManifestAssetList(null, "stylesheets")).toEqual([]);
    expect(readManifestAssetList({}, "stylesheets")).toEqual([]);
  });

  it("resolves relative hrefs against baseUrl", () => {
    const manifest = { stylesheets: ["/styles/globals.css"] };
    const result = readManifestAssetList(manifest, "stylesheets", "https://source.example.com");
    expect(result).toContain("https://source.example.com/styles/globals.css");
  });
});

// ---------------------------------------------------------------------------
// resolveProposalTargetPreviewHtml
// ---------------------------------------------------------------------------

describe("resolveProposalTargetPreviewHtml (import-page-helpers)", () => {
  const cdnFreeAssets = {
    headMarkup: "",
    tailwindRuntimeSrc: null,
    platformCssSrc: "http://localhost:5173/src/style.css"
  };

  it("works without importMaster — returns valid HTML with platform CSS link", () => {
    const html = resolveProposalTargetPreviewHtml({
      proposalHtml: "<section><h1>Hello</h1></section>",
      theme: buildThemeImport(),
      hostAssets: cdnFreeAssets
    });
    expect(html).toContain("<!doctype html>");
    expect(html).toContain(`href="http://localhost:5173/src/style.css"`);
    expect(html).toContain("lmnas-canonical-vars");
    expect(html).not.toContain("cdn.tailwindcss.com");
    expect(html).not.toContain("window.tailwind.config");
  });

  it("filters CDN stylesheets from importMaster.sourceAssetManifest", () => {
    const html = resolveProposalTargetPreviewHtml({
      proposalHtml: "<section>Block</section>",
      theme: buildThemeImport(),
      hostAssets: cdnFreeAssets,
      importMaster: {
        id: "im-1", importKey: "k", sourceType: "raw_html", sourceRef: "test.html",
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        sourceAssetManifest: {
          stylesheets: ["https://source.example.com/globals.css", "https://cdn.tailwindcss.com"]
        } as unknown as Record<string, string>,
        sourceHtml: "", referencePreviewHtml: "", targetPreviewHtml: "",
        selectedThemeKey: "sunrise", selectedShellKey: "", importMode: "blocks",
        status: "processed", lifecycle: "draft", createdAt: "2026-03-28", updatedAt: "2026-03-28"
      }
    });
    expect(html).toContain("globals.css");
    expect(html).not.toMatch(/<link[^>]+href=["'][^"']*cdn\.tailwindcss\.com[^"']*["'][^>]*>/);
  });

  it("uses persistedTargetPreviewHtml as fallback when proposalHtml is empty", () => {
    const html = resolveProposalTargetPreviewHtml({
      proposalHtml: "",
      persistedTargetPreviewHtml: "<section><h2>Persisted</h2></section>",
      theme: buildThemeImport(),
      hostAssets: cdnFreeAssets
    });
    expect(html).toContain("Persisted");
  });
});

// ---------------------------------------------------------------------------
// Import-pipeline theme fixture (separate from page-preview fixture above)
// ---------------------------------------------------------------------------

function buildThemeImport(overrides: Partial<StudioTheme> = {}): StudioTheme {
  return {
    id: "theme-sunrise",
    themeKey: "sunrise",
    name: "Sunrise",
    status: "active",
    sourceRef: "test",
    createdAt: "2026-03-28",
    updatedAt: "2026-03-28",
    tokenCoverage: 1,
    themeDebt: "none",
    darkMode: false,
    tokens: [
      { key: "primary",          label: "Primary",      category: "color",      value: "#ff4f00", cssVariable: "--color-primary",          mapped: true },
      { key: "background-light", label: "BG Light",     category: "color",      value: "#fff6e9", cssVariable: "--color-background-light", mapped: true },
      { key: "background-dark",  label: "BG Dark",      category: "color",      value: "#1f0d05", cssVariable: "--color-background-dark",  mapped: true },
      { key: "foreground",       label: "Foreground",   category: "color",      value: "#2b1207", cssVariable: "--foreground",             mapped: true },
      { key: "font-display",     label: "Display Font", category: "typography", value: "Fraunces, serif", cssVariable: "--font-display",   mapped: true }
    ],
    ...overrides
  };
}
