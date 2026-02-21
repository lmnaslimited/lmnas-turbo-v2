import React from "react";
import { notFound } from "next/navigation";
import { track } from "@lmnas/analytics";
import { getPageBySlug, PageNotFoundError, StrapiUnreachableError } from "@lmnas/integrations";
import { LayoutRegistry } from "@lmnas/layouts";
import { PageRenderer } from "@lmnas/renderer";
import { buildSeo } from "@lmnas/seo-engine";

export default async function HomePage() {
  let page;
  try {
    page = await getPageBySlug("home", { preview: false });
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
  track("page_view", { slug: page.slug, pageType: page.pageType });

  return (
    <Layout title={page.layoutKey}>
      <main>
        <h1 style={{ marginTop: 0 }}>Hello Platform</h1>
        <p>Meta title: {seo.meta.title ?? "n/a"}</p>
        <PageRenderer blocks={page.blocks} preview={false} />
      </main>
    </Layout>
  );
}
