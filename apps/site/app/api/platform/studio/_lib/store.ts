import type {
  StudioBlockTemplate,
  StudioMenuItem,
  StudioPageDocument,
  StudioSettings,
  StudioShell,
  StudioTheme,
  StudioWidgetRecord
} from "../../../../platform/onboarding/_lib/studio-types";

export type StudioStore = {
  themes: StudioTheme[];
  shells: StudioShell[];
  blocks: StudioBlockTemplate[];
  pages: StudioPageDocument[];
  widgets: StudioWidgetRecord[];
  settings: StudioSettings;
};

declare global {
  var __lmnasStudioStore__: StudioStore | undefined;
}

function nowDateIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function seedMenuItems(items: Array<{ id: string; label: string; href: string; children?: StudioMenuItem[] }>): StudioMenuItem[] {
  return items.map((item) => ({
    id: item.id,
    label: item.label,
    href: item.href,
    ...(item.children ? { children: seedMenuItems(item.children) } : {})
  }));
}

export function createSeedStore(): StudioStore {
  const now = nowDateIso();
  return {
    themes: [
      {
        id: "theme-default",
        themeKey: "default",
        name: "LMNAs Default",
        status: "active",
        sourceRef: "globals.css",
        themeScopeClass: "theme-default",
        themeMode: "dark",
        createdAt: "2026-02-15",
        updatedAt: now,
        tokenCoverage: 0.92,
        themeDebt: "3 arbitrary color values detected outside token system",
        darkMode: true,
        tokens: [
          { key: "bg", label: "Background", category: "color", value: "#0b1120", cssVariable: "--color-lmnas-bg", mapped: true },
          {
            key: "text",
            label: "Primary Text",
            category: "color",
            value: "#f1f5f9",
            cssVariable: "--color-lmnas-text",
            mapped: true
          },
          {
            key: "font-display",
            label: "Display Font",
            category: "typography",
            value: "Manrope, sans-serif",
            cssVariable: "--font-display",
            mapped: true
          }
        ]
      }
    ],
    shells: [
      {
        id: "shell-main",
        key: "shell-main",
        name: "Main Shell",
        role: "full",
        status: "active",
        updatedAt: now,
        menuItems: seedMenuItems([
          { id: "m1", label: "Products", href: "/products" },
          {
            id: "m2",
            label: "Solutions",
            href: "/solutions",
            children: seedMenuItems([
              { id: "m2a", label: "Enterprise", href: "/solutions/enterprise" },
              { id: "m2b", label: "Startups", href: "/solutions/startups" }
            ])
          },
          { id: "m3", label: "Pricing", href: "/pricing" }
        ]),
        actions: [
          { id: "sa-book-demo", label: "Book Demo", type: "open_modal", target: "#book-demo" },
          { id: "sa-sign-in", label: "Sign In", type: "link_url", target: "/login" }
        ],
        navbarBlocks: ["blk-hero-1"],
        footerBlocks: ["blk-cta-1"]
      },
      {
        id: "shell-minimal",
        key: "shell-minimal",
        name: "Minimal Shell",
        role: "full",
        status: "inactive",
        updatedAt: now,
        menuItems: seedMenuItems([
          { id: "mm1", label: "Home", href: "/" },
          { id: "mm2", label: "About", href: "/about" }
        ]),
        actions: [{ id: "mm-action", label: "Get Started", type: "link_url", target: "/signup" }],
        navbarBlocks: ["blk-hero-1"],
        footerBlocks: ["blk-cta-1"]
      }
    ],
    blocks: [
      {
        id: "blk-hero-1",
        key: "blk-hero-1",
        name: "Hero Section",
        family: "hero",
        status: "active",
        lifecycle: "published",
        scope: "global",
        schemaStatus: "valid",
        themeKey: "default",
        sourceType: "seed",
        sourceRef: "seed",
        confidence: 1,
        editableFields: ["heading", "subheading", "cta_primary", "cta_secondary"],
        actions: [
          { id: "hero-action-primary", label: "Get Started", type: "link_url", target: "/signup" },
          { id: "hero-action-secondary", label: "Learn More", type: "scroll_to_section", target: "#features" }
        ],
        inUseCount: 1,
        usageCount: 1,
        createdAt: "2026-03-08",
        updatedAt: now
      },
      {
        id: "blk-cta-1",
        key: "blk-cta-1",
        name: "CTA Banner",
        family: "cta_banner",
        status: "active",
        lifecycle: "published",
        scope: "global",
        schemaStatus: "valid",
        themeKey: "default",
        sourceType: "seed",
        sourceRef: "seed",
        confidence: 1,
        editableFields: ["heading", "subheading", "cta_text"],
        actions: [{ id: "cta-action", label: "Book Appointment", type: "external_booking", target: "https://calendly.com/example" }],
        inUseCount: 0,
        usageCount: 0,
        createdAt: "2026-03-08",
        updatedAt: now
      }
    ],
    pages: [
      {
        id: "page-home",
        name: "Home",
        slug: "home",
        locale: "en",
        activeShellId: "shell-main",
        shellKey: "shell-main",
        themeKey: "default",
        lifecycle: "draft",
        status: "draft",
        blockOrder: ["blk-hero-1", "blk-cta-1"],
        fieldValues: {},
        actionOverrides: {},
        productMapping: "LENS-CPQ",
        industryMapping: ["fintech", "saas"],
        primaryCta: {
          text: "Get Started",
          url: "/signup"
        },
        conversionConfig: {
          trackConversions: true,
          strategy: "Track Conversions",
          valuePoints: 50
        },
        campaignUtmStrategy: {
          source: "website",
          medium: "studio",
          campaign: "home-launch"
        },
        taxonomyState: {
          valid: true,
          tags: ["home", "growth"]
        },
        seoMetadata: {
          metaTitle: "Home | LMNAs Studio",
          metaDescription: "Scale your business faster than ever."
        },
        seoJsonLdValid: true,
        blockSchemaValid: true,
        previewValid: true,
        updatedAt: now
      }
    ],
    widgets: [
      {
        id: "widget-calendar-booking",
        key: "widget-calendar-booking",
        name: "Calendar Booking Widget",
        widgetType: "booking_popup",
        surface: "modal",
        status: "active",
        lifecycle: "published",
        readiness: "ready",
        repoPath: "/components/widgets/calendar-widget.ts",
        description: "Repo-first booking widget mapping.",
        editableFields: ["title", "ctaText"],
        visualMockHtml:
          "<div style=\"padding:14px;border:1px dashed #334155;border-radius:8px;font-family:system-ui\"><strong>Calendar Widget</strong><p style=\"margin-top:6px;color:#64748b;font-size:12px\">Visual mock only. Runtime executes from repo path.</p></div>",
        placement: {
          mode: "reference"
        },
        updatedAt: now
      }
    ],
    settings: {
      fidelity: {
        mode: "allow-below-threshold",
        threshold: 0.25
      }
    }
  };
}

export function getStudioStore(): StudioStore {
  if (!globalThis.__lmnasStudioStore__) {
    globalThis.__lmnasStudioStore__ = createSeedStore();
  }
  return globalThis.__lmnasStudioStore__;
}

export function readStoreSnapshot(): StudioStore {
  return clone(getStudioStore());
}

export function replaceStore(next: StudioStore): StudioStore {
  globalThis.__lmnasStudioStore__ = clone(next);
  return getStudioStore();
}

export function resetStore(): StudioStore {
  globalThis.__lmnasStudioStore__ = createSeedStore();
  return getStudioStore();
}
