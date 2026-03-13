import { beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";

const { getPageBySlugMock, draftModeMock } = vi.hoisted(() => {
  return {
    draftModeMock: vi.fn(async () => ({ isEnabled: false })),
    getPageBySlugMock: vi.fn(async () => ({
      slug: "home",
      pageType: "home",
      layoutKey: "homeLayout",
      conversionConfig: {
        intent: "book",
        eventName: "page_primary_cta_click"
      },
      blocks: [],
      seo: {
        metaTitle: "Home",
        metaDescription: "Home",
        canonical: "https://lmnas.com",
        robots: "index,follow"
      }
    }))
  };
});

const { buildShellRenderModelMock } = vi.hoisted(() => ({
  buildShellRenderModelMock: vi.fn(async () => ({
    mainNavigation: { key: "main", items: [] },
    footerNavigation: { key: "footer", items: [] },
    utilityNavigation: { key: "utility", items: [] }
  }))
}));

vi.mock("next/headers", () => ({
  draftMode: draftModeMock
}));

vi.mock("@lmnas/integrations", () => ({
  getPageBySlug: getPageBySlugMock,
  PageNotFoundError: class PageNotFoundError extends Error {},
  StrapiUnreachableError: class StrapiUnreachableError extends Error {}
}));

vi.mock("@lmnas/layouts", () => ({
  LayoutRegistry: {
    homeLayout: ({ children }: { children: unknown }) => children,
    productLayout: ({ children }: { children: unknown }) => children,
    solutionLayout: ({ children }: { children: unknown }) => children,
    industryLayout: ({ children }: { children: unknown }) => children,
    simpleLayout: ({ children }: { children: unknown }) => children
  }
}));

vi.mock("@lmnas/seo-engine", () => ({
  buildSeo: vi.fn(() => ({ meta: { title: "Home" }, jsonLd: [] }))
}));

vi.mock("@lmnas/renderer", () => ({
  PageRenderer: () => null
}));

vi.mock("@lmnas/analytics", () => ({
  track: vi.fn()
}));

vi.mock("../lib/shell", () => ({
  buildShellRenderModel: buildShellRenderModelMock
}));

import HomePage from "./page";

describe("site home route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("uses GraphQL integration page loader for home slug", async () => {
    draftModeMock.mockResolvedValue({ isEnabled: true });
    await HomePage();

    expect(getPageBySlugMock).toHaveBeenCalledWith("home", { preview: true });
    expect(buildShellRenderModelMock).toHaveBeenCalled();
  });

  it("does not import page mock fixtures in site page routes", () => {
    const root = path.resolve(__dirname, "../../..");
    const files = [
      path.join(root, "apps/site/app/page.tsx"),
      path.join(root, "apps/site/app/[...slug]/page.tsx"),
      path.join(root, "apps/site/app/preview/page.tsx")
    ];

    for (const file of files) {
      const source = readFileSync(file, "utf8");
      expect(source).not.toContain("@lmnas/testkit");
    }
  });
});
