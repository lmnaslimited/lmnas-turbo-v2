import { describe, expect, it } from "vitest";
import { createCanonicalBlockSnapshot } from "../../../../lib/studio-canonical";
import type { StudioBlockTemplate, StudioPageDocument, StudioShell, StudioTheme } from "./studio-types";
import {
  buildPlatformBlockPreviewDocument,
  buildPlatformPagePreviewDocument,
  canonicalizeBlockOrder,
  createStaticPlatformPreviewAssets
} from "./platform-preview-shared";

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
