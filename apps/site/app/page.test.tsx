import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";

const { getPageBySlugMock, draftModeMock, loadStudioPageForRouteMock, notFoundMock } = vi.hoisted(() => {
  return {
    draftModeMock: vi.fn(async () => ({ isEnabled: false })),
    loadStudioPageForRouteMock: vi.fn(async (): Promise<any> => null),
    notFoundMock: vi.fn(() => {
      throw new Error("NEXT_NOT_FOUND");
    }),
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

vi.mock("next/navigation", () => ({
  notFound: notFoundMock
}));

vi.mock("@lmnas/integrations", () => ({
  getPageBySlug: getPageBySlugMock,
  PageNotFoundError: class PageNotFoundError extends Error {},
  StrapiUnreachableError: class StrapiUnreachableError extends Error {}
}));

vi.mock("../lib/studio-page-runtime", () => ({
  loadStudioPageForRoute: loadStudioPageForRouteMock
}));

vi.mock("../lib/studio-runtime-page-view", () => ({
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

import HomePage, { generateMetadata } from "./page";

describe("site home route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    draftModeMock.mockResolvedValue({ isEnabled: false });
    loadStudioPageForRouteMock.mockResolvedValue({ state: "missing" });
  });

  it("uses GraphQL integration page loader for home slug", async () => {
    draftModeMock.mockResolvedValue({ isEnabled: true });
    await HomePage();

    expect(getPageBySlugMock).toHaveBeenCalledWith("home", { preview: true });
    expect(buildShellRenderModelMock).toHaveBeenCalled();
  });

  it("renders canonical studio home page html before legacy loader", async () => {
    loadStudioPageForRouteMock.mockResolvedValue({
      state: "ready",
      page: {
        id: "studio-home",
        slug: "home",
        locale: "en",
        status: "published",
        canonicalPath: "/en",
        canonicalUrl: "https://lmnas.com/en",
        seoMetadata: {
          metaTitle: "Home",
          metaDescription: "Home"
        },
        renderBlocks: [],
        jsonLd: []
      }
    });

    const result = await HomePage();

    expect(getPageBySlugMock).not.toHaveBeenCalled();
    expect(React.isValidElement(result)).toBe(true);
    expect((result as React.ReactElement<{ page?: { slug?: string } }>).props.page?.slug).toBe("home");
  });

  it("generates metadata from governed studio runtime pages", async () => {
    loadStudioPageForRouteMock.mockResolvedValue({
      state: "ready",
      page: {
        id: "studio-home",
        slug: "home",
        locale: "en",
        status: "published",
        canonicalPath: "/en",
        canonicalUrl: "https://lmnas.com/en",
        seoMetadata: {
          metaTitle: "Governed Home",
          metaDescription: "Governed Home Description"
        },
        renderBlocks: [],
        jsonLd: []
      }
    });

    const metadata = await generateMetadata();

    expect(metadata.title).toBe("Governed Home");
    expect(metadata.description).toBe("Governed Home Description");
    expect(metadata.alternates?.canonical).toBe("https://lmnas.com/en");
    expect(metadata.robots).toBe("index,follow");
  });

  it("blocks public studio pages that fail runtime governance", async () => {
    draftModeMock.mockResolvedValue({ isEnabled: false });
    loadStudioPageForRouteMock.mockResolvedValue({
      state: "blocked",
      page: {
        id: "studio-home",
        slug: "home",
        locale: "en",
        status: "published",
        canonicalPath: "/en",
        canonicalUrl: "https://lmnas.com/en",
        seoMetadata: {
          metaTitle: "Blocked Home",
          metaDescription: "Blocked Home"
        }
      },
      issues: ["Primary CTA is required."]
    });

    await expect(HomePage()).rejects.toThrow("NEXT_NOT_FOUND");
    expect(notFoundMock).toHaveBeenCalledTimes(1);
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
