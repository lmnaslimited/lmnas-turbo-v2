import { getPageBySlug } from '@lmnas/integrations';
import { PageRenderer } from '@lmnas/renderer';

export default async function PreviewPage({ searchParams }: { searchParams: Promise<{ slug?: string; token?: string }> }) {
  const params = await searchParams;
  const slug = params.slug ?? 'home';
  const token = params.token;
  const page = await getPageBySlug(slug, { preview: true, token });

  return (
    <main>
      <h1>Preview: {slug}</h1>
      <PageRenderer blocks={page.blocks} preview />
    </main>
  );
}
