import type {
  StudioBlockTemplate,
  StudioMenuItem,
  StudioPageDocument,
  StudioShell,
  StudioTheme
} from "../../../../platform/onboarding/_lib/studio-types";

type StudioStore = {
  themes: StudioTheme[];
  shells: StudioShell[];
  blocks: StudioBlockTemplate[];
  pages: StudioPageDocument[];
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

function createSeedStore(): StudioStore {
  const now = nowDateIso();
  return {
    themes: [
      {
        id: "theme-default",
        themeKey: "default",
        name: "LMNAs Default",
        status: "active",
        sourceRef: "globals.css",
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
        footerBlocks: ["blk-cta-1"],
        previewHtml:
          "<nav style=\"display:flex;justify-content:space-between;align-items:center;padding:14px 28px;background:#0f172a;color:#f8fafc;font-family:system-ui\"><strong style=\"font-size:16px\">LMNAs</strong><div style=\"display:flex;gap:20px\"><a href='#' style=\"color:#94a3b8;text-decoration:none;font-size:13px\">Products</a><a href='#' style=\"color:#94a3b8;text-decoration:none;font-size:13px\">Solutions</a><a href='#' style=\"color:#94a3b8;text-decoration:none;font-size:13px\">Pricing</a></div><div style=\"display:flex;gap:8px\"><button style=\"background:transparent;border:1px solid #334155;color:#94a3b8;padding:6px 14px;border-radius:6px;font-size:12px\">Sign In</button><button style=\"background:#3b82f6;border:none;color:white;padding:6px 14px;border-radius:6px;font-size:12px;font-weight:600\">Book Demo</button></div></nav>"
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
        footerBlocks: ["blk-cta-1"],
        previewHtml:
          "<nav style=\"display:flex;justify-content:space-between;align-items:center;padding:12px 24px;background:#111827;color:#e2e8f0;font-family:system-ui\"><span style=\"font-size:14px;font-weight:700\">LMNAs</span><div style=\"display:flex;gap:16px;align-items:center\"><a href='#' style=\"color:#64748b;text-decoration:none;font-size:13px\">Home</a><a href='#' style=\"color:#64748b;text-decoration:none;font-size:13px\">About</a><button style=\"background:#22c55e;border:none;color:white;padding:5px 12px;border-radius:6px;font-size:11px;font-weight:600\">Get Started</button></div></nav>"
      }
    ],
    blocks: [
      {
        id: "blk-hero-1",
        key: "blk-hero-1",
        name: "Hero Section",
        family: "hero",
        status: "active",
        themeKey: "default",
        sourceType: "seed",
        sourceRef: "seed",
        confidence: 1,
        editableFields: ["heading", "subheading", "cta_primary", "cta_secondary"],
        actions: [
          { id: "hero-action-primary", label: "Get Started", type: "link_url", target: "/signup" },
          { id: "hero-action-secondary", label: "Learn More", type: "scroll_to_section", target: "#features" }
        ],
        previewHtml:
          "<section style=\"padding:56px 32px;background:linear-gradient(135deg,#0f172a 0%,#1e293b 100%);color:#f8fafc;font-family:system-ui\"><h1 style=\"font-size:32px;font-weight:800;letter-spacing:-0.8px;margin:0\">Build faster with LMNAs</h1><p style=\"color:#94a3b8;margin-top:10px;font-size:14px;max-width:480px;line-height:1.5\">Launch governed pages in minutes. Ship beautiful landing pages backed by a real CMS.</p><div style=\"margin-top:20px;display:flex;gap:10px\"><button style=\"background:#3b82f6;border:none;color:white;padding:10px 20px;border-radius:8px;font-size:13px;font-weight:600\">Get Started</button><button style=\"background:transparent;border:1px solid #334155;color:#94a3b8;padding:10px 20px;border-radius:8px;font-size:13px\">Learn More</button></div></section>",
        inUseCount: 1,
        createdAt: "2026-03-08",
        updatedAt: now
      },
      {
        id: "blk-cta-1",
        key: "blk-cta-1",
        name: "CTA Banner",
        family: "cta_banner",
        status: "active",
        themeKey: "default",
        sourceType: "seed",
        sourceRef: "seed",
        confidence: 1,
        editableFields: ["heading", "subheading", "cta_text"],
        actions: [{ id: "cta-action", label: "Book Appointment", type: "external_booking", target: "https://calendly.com/example" }],
        previewHtml:
          "<section style=\"padding:40px 32px;background:linear-gradient(135deg,#3b82f6,#1d4ed8);color:#fff;text-align:center;font-family:system-ui\"><h2 style=\"font-size:24px;font-weight:700;margin:0\">Ready to transform your web presence?</h2><p style=\"margin-top:8px;font-size:14px;opacity:0.85\">Start your free trial today.</p><button style=\"margin-top:16px;background:#fff;color:#1d4ed8;border:none;padding:10px 24px;border-radius:8px;font-weight:600;font-size:13px\">Book Appointment</button></section>",
        inUseCount: 0,
        createdAt: "2026-03-08",
        updatedAt: now
      }
    ],
    pages: []
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
