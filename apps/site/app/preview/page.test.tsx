import { beforeEach, describe, expect, it, vi } from "vitest";

const { getPageBySlugMock } = vi.hoisted(() => {
  return {
    getPageBySlugMock: vi.fn(async (slug: string) => ({
      slug,
      pageType: "home",
      layoutKey: "homeLayout",
      conversionConfig: { primary: "book", product: "platform", industry: "healthcare" },
      blocks: [],
      seo: {
        metaTitle: "Preview",
        metaDescription: "Preview",
        canonical: "https://lmnas.com",
        robots: "noindex,nofollow"
      }
    }))
  };
});

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

vi.mock("@lmnas/renderer", () => ({
  PageRenderer: () => null
}));

import PreviewPage from "./page";

describe("preview route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.PREVIEW_SECRET = "local-preview-token";
    process.env.STRAPI_PREVIEW_TOKEN = "local-preview-token";
  });

  it("calls page loader in preview mode", async () => {
    await PreviewPage({
      searchParams: Promise.resolve({ slug: "home", token: "local-preview-token" })
    });

    expect(getPageBySlugMock).toHaveBeenCalledWith("home", { preview: true });
  });

  it("rejects request when preview token is missing", async () => {
    const result = await PreviewPage({
      searchParams: Promise.resolve({ slug: "home" })
    });

    expect(getPageBySlugMock).not.toHaveBeenCalled();
    expect((result as { props?: { children?: unknown } }).props?.children).toContain("Invalid preview token");
  });
});
