import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { getPageBySlugMock, draftModeMock, loadStudioPageForRouteMock, notFoundMock } = vi.hoisted(() => {
  return {
    draftModeMock: vi.fn(async () => ({ isEnabled: false })),
    loadStudioPageForRouteMock: vi.fn(async (): Promise<any> => null),
    notFoundMock: vi.fn(() => {
      throw new Error("NEXT_NOT_FOUND");
    }),
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

vi.mock("next/navigation", () => ({
  notFound: notFoundMock
}));

vi.mock("@lmnas/integrations", () => ({
  getPageBySlug: getPageBySlugMock,
  PageNotFoundError: class PageNotFoundError extends Error {},
  StrapiUnreachableError: class StrapiUnreachableError extends Error {}
}));

vi.mock("../../lib/studio-page-runtime", () => ({
  loadStudioPageForRoute: loadStudioPageForRouteMock
}));

vi.mock("../../lib/studio-runtime-page-view", () => ({
  StudioRuntimePageView: ({ page }: { page: { slug: string } }) => <div data-testid="studio-runtime-page-view">{page.slug}</div>,
  StudioRuntimeBlockedView: ({ issues }: { issues: string[] }) => <div data-testid="studio-runtime-blocked-view">{issues.join(" | ")}</div>
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

import SlugPage, { generateMetadata } from "./page";

describe("site slug route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    draftModeMock.mockResolvedValue({ isEnabled: false });
    loadStudioPageForRouteMock.mockResolvedValue({ state: "missing" });
  });

  it("uses GraphQL integration page loader for joined slug", async () => {
    draftModeMock.mockResolvedValue({ isEnabled: true });
    await SlugPage({ params: Promise.resolve({ slug: ["products", "cpq"] }) });

    expect(getPageBySlugMock).toHaveBeenCalledWith("products/cpq", { preview: true });
    expect(buildShellRenderModelMock).toHaveBeenCalled();
  });

  it("renders canonical studio-page html when a published studio route exists", async () => {
    loadStudioPageForRouteMock.mockResolvedValue({
      state: "ready",
      page: {
        id: "studio-page-1",
        slug: "home",
        locale: "en",
        status: "published",
        canonicalPath: "/en/home",
        canonicalUrl: "https://lmnas.com/en/home",
        seoMetadata: {
          metaTitle: "Home",
          metaDescription: "Home"
        },
        renderBlocks: [],
        jsonLd: []
      }
    });

    const result = await SlugPage({ params: Promise.resolve({ slug: ["en", "home"] }) });

    expect(getPageBySlugMock).not.toHaveBeenCalled();
    expect(React.isValidElement(result)).toBe(true);
    expect((result as React.ReactElement<{ page?: { slug?: string } }>).props.page?.slug).toBe("home");
  });

  it("generates metadata from governed studio slug pages", async () => {
    loadStudioPageForRouteMock.mockResolvedValue({
      state: "ready",
      page: {
        id: "studio-page-1",
        slug: "products/cpq",
        locale: "en",
        status: "published",
        canonicalPath: "/en/products/cpq",
        canonicalUrl: "https://lmnas.com/en/products/cpq",
        seoMetadata: {
          metaTitle: "Governed CPQ",
          metaDescription: "Governed CPQ Description"
        },
        renderBlocks: [],
        jsonLd: []
      }
    });

    const metadata = await generateMetadata({ params: Promise.resolve({ slug: ["products", "cpq"] }) });

    expect(metadata.title).toBe("Governed CPQ");
    expect(metadata.description).toBe("Governed CPQ Description");
    expect(metadata.alternates?.canonical).toBe("https://lmnas.com/en/products/cpq");
  });

  it("blocks public slug routes that fail runtime governance", async () => {
    draftModeMock.mockResolvedValue({ isEnabled: false });
    loadStudioPageForRouteMock.mockResolvedValue({
      state: "blocked",
      page: {
        id: "studio-page-1",
        slug: "products/cpq",
        locale: "en",
        status: "published",
        canonicalPath: "/en/products/cpq",
        canonicalUrl: "https://lmnas.com/en/products/cpq",
        seoMetadata: {
          metaTitle: "Blocked CPQ",
          metaDescription: "Blocked CPQ"
        }
      },
      issues: ["Preview acceptance is incomplete."]
    });

    await expect(SlugPage({ params: Promise.resolve({ slug: ["products", "cpq"] }) })).rejects.toThrow("NEXT_NOT_FOUND");
    expect(notFoundMock).toHaveBeenCalledTimes(1);
  });
});
