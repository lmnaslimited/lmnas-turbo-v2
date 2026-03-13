import React from "react";
import { draftMode } from "next/headers";
import { notFound } from "next/navigation";
import { track } from "@lmnas/analytics";
import { getPageBySlug, PageNotFoundError, StrapiUnreachableError } from "@lmnas/integrations";
import { LayoutRegistry } from "@lmnas/layouts";
import { PageRenderer } from "@lmnas/renderer";
import { buildSeo } from "@lmnas/seo-engine";
import { buildShellRenderModel } from "../lib/shell";
import { loadStudioPageForRoute } from "../lib/studio-page-runtime";

export default async function HomePage() {
  const { isEnabled: isPreview } = await draftMode();
  const studioPage = await loadStudioPageForRoute({
    slug: "home",
    locale: "en",
    preview: isPreview
  });

  if (studioPage) {
    track("page_view", { slug: studioPage.slug, pageType: "simple" });
    return <div data-testid="studio-runtime-page" suppressHydrationWarning dangerouslySetInnerHTML={{ __html: studioPage.bodyHtml }} />;
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
