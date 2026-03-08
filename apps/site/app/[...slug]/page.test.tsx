import { beforeEach, describe, expect, it, vi } from "vitest";

const { getPageBySlugMock, draftModeMock } = vi.hoisted(() => {
  return {
    draftModeMock: vi.fn(async () => ({ isEnabled: false })),
    getPageBySlugMock: vi.fn(async (slug: string) => ({
      slug,
      pageType: "product",
      layoutKey: "productLayout",
      conversionConfig: {
        intent: "book",
        eventName: "page_primary_cta_click"
      },
      blocks: [],
      seo: {
        metaTitle: "CPQ",
        metaDescription: "CPQ",
        canonical: "https://lmnas.com/products/cpq",
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
  buildSeo: vi.fn(() => ({ meta: { title: "CPQ" }, jsonLd: [] }))
}));

vi.mock("@lmnas/renderer", () => ({
  PageRenderer: () => null
}));

vi.mock("@lmnas/analytics", () => ({
  track: vi.fn()
}));

vi.mock("../../lib/shell", () => ({
  buildShellRenderModel: buildShellRenderModelMock
}));

import SlugPage from "./page";

describe("site slug route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("uses GraphQL integration page loader for joined slug", async () => {
    draftModeMock.mockResolvedValue({ isEnabled: true });
    await SlugPage({ params: Promise.resolve({ slug: ["products", "cpq"] }) });

    expect(getPageBySlugMock).toHaveBeenCalledWith("products/cpq", { preview: true });
    expect(buildShellRenderModelMock).toHaveBeenCalled();
  });
});
