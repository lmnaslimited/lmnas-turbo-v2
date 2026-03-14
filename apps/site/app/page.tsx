import type { Metadata } from "next";
import React from "react";
import { draftMode } from "next/headers";
import { notFound } from "next/navigation";
import { track } from "@lmnas/analytics";
import { getPageBySlug, PageNotFoundError, StrapiUnreachableError } from "@lmnas/integrations";
import { LayoutRegistry } from "@lmnas/layouts";
import { PageRenderer } from "@lmnas/renderer";
import { buildSeo } from "@lmnas/seo-engine";
import { buildMetadataFromSeo, buildStudioRuntimeMetadata } from "../lib/route-metadata";
import { buildShellRenderModel } from "../lib/shell";
import { loadStudioPageForRoute } from "../lib/studio-page-runtime";
import { StudioRuntimeBlockedView, StudioRuntimePageView } from "../lib/studio-runtime-page-view";

export async function generateMetadata(): Promise<Metadata> {
  const { isEnabled: isPreview } = await draftMode();
  const studioResult = await loadStudioPageForRoute({
    slug: "home",
    locale: "en",
    preview: isPreview
  });

  if (studioResult.state === "ready") {
    return buildStudioRuntimeMetadata(studioResult.page);
  }

  if (studioResult.state === "blocked") {
    return {
      title: studioResult.page.seoMetadata.metaTitle || "Studio preview blocked",
      description: studioResult.page.seoMetadata.metaDescription,
      alternates: {
        canonical: studioResult.page.canonicalUrl
      },
      robots: "noindex,nofollow"
    };
  }

  try {
    const page = await getPageBySlug("home", { preview: isPreview });
    const seo = buildSeo(page);
    return buildMetadataFromSeo(seo.meta);
  } catch {
    return {};
  }
}

export default async function HomePage() {
  const { isEnabled: isPreview } = await draftMode();
  const studioResult = await loadStudioPageForRoute({
    slug: "home",
    locale: "en",
    preview: isPreview
  });

  if (studioResult.state === "ready") {
    track("page_view", { slug: studioResult.page.slug, pageType: "simple" });
    return <StudioRuntimePageView page={studioResult.page} preview={isPreview} />;
  }

  if (studioResult.state === "blocked") {
    if (!isPreview) {
      notFound();
    }
    return <StudioRuntimeBlockedView issues={studioResult.issues} preview={isPreview} />;
  }

  let page;
  try {
    page = await getPageBySlug("home", { preview: isPreview });
  } catch (error) {
    if (error instanceof PageNotFoundError) {
      notFound();
    }
    if (error instanceof StrapiUnreachableError) {
      return <main>strapi_unreachable</main>;
    }
    throw error;
  }
  const Layout = LayoutRegistry[page.layoutKey];
  buildSeo(page);
  const shell = await buildShellRenderModel(page);
  track("page_view", { slug: page.slug, pageType: page.pageType });

  return (
    <Layout title={page.layoutKey} shell={shell}>
      <PageRenderer blocks={page.blocks} preview={isPreview} />
    </Layout>
  );
}
