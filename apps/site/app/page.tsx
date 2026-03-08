import React from "react";
import { draftMode } from "next/headers";
import { notFound } from "next/navigation";
import { track } from "@lmnas/analytics";
import { getPageBySlug, PageNotFoundError, StrapiUnreachableError } from "@lmnas/integrations";
import { LayoutRegistry } from "@lmnas/layouts";
import { PageRenderer } from "@lmnas/renderer";
import { buildSeo } from "@lmnas/seo-engine";
import { buildShellRenderModel } from "../lib/shell";

export default async function HomePage() {
  const { isEnabled: isPreview } = await draftMode();
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
  const seo = buildSeo(page);
  const shell = await buildShellRenderModel(page);
  track("page_view", { slug: page.slug, pageType: page.pageType });

  return (
    <Layout title={page.layoutKey} shell={shell}>
      <main className="lmnas-page-main">
        <h1 className="lmnas-page-headline">Website Operating System</h1>
        <p className="lmnas-page-subline">Meta title: {seo.meta.title ?? "n/a"}</p>
        <PageRenderer blocks={page.blocks} preview={isPreview} />
      </main>
    </Layout>
  );
}
