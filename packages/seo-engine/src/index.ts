import type { Page } from '@lmnas/contracts';

export function buildSeo(page: Page) {
  const meta = {
    title: page.seo.metaTitle ?? `LMNAS | ${page.slug}`,
    description: page.seo.metaDescription ?? 'LMNAS Turbo v2',
    canonical: page.seo.canonical,
    robots: page.seo.robots
  };

  const faqBlock = page.blocks.find((b) => b.type === 'faq');
  const jsonLd: object[] = [];
  if (faqBlock && faqBlock.type === 'faq') {
    jsonLd.push({
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      mainEntity: faqBlock.items.map((item) => ({ '@type': 'Question', name: item.question, acceptedAnswer: { '@type': 'Answer', text: item.answer } }))
    });
  }
  return { meta, jsonLd };
}
