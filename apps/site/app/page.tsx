import { getPageBySlug } from '@lmnas/integrations';
import { PageRenderer } from '@lmnas/renderer';
import { buildSeo } from '@lmnas/seo-engine';

export async function generateMetadata() {
  const page = await getPageBySlug('home');
  const seo = buildSeo(page);
  return {
    title: seo.meta.title,
    description: seo.meta.description
  };
}

export default async function HomePage() {
  const page = await getPageBySlug('home');
  const seo = buildSeo(page);

  return (
    <main>
      <PageRenderer blocks={page.blocks} preview={false} />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(seo.jsonLd) }}
      />
    </main>
  );
}
