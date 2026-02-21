import { describe, expect, it, vi } from "vitest";

vi.mock("@lmnas/integrations", () => ({
  getBlogPostBySlug: vi.fn(async (slug: string) => ({
    slug,
    title: "Title",
    excerpt: "Excerpt",
    body: "Body",
    seo: {
      metaTitle: "Title",
      metaDescription: "Excerpt",
      canonical: "https://lmnas.com/blogs/" + slug,
      robots: "index,follow"
    }
  }))
}));

vi.mock("@lmnas/seo-engine", () => ({
  buildBlogSeo: vi.fn((post: { slug: string }) => ({
    meta: {
      title: "Title",
      description: "Excerpt",
      canonical: `https://lmnas.com/blogs/${post.slug}`,
      robots: "index,follow"
    },
    jsonLd: []
  }))
}));

vi.mock("@lmnas/analytics", () => ({
  track: vi.fn()
}));

import { generateMetadata } from "./page";

describe("site blog metadata", () => {
  it("uses lmnas canonical base", async () => {
    const metadata = await generateMetadata({ params: Promise.resolve({ slug: "phase-0-baseline" }) });
    expect(metadata.alternates?.canonical).toBe("https://lmnas.com/blogs/phase-0-baseline");
  });
});
