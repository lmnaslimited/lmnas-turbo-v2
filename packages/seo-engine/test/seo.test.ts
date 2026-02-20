import { describe, expect, it } from 'vitest';
import { buildSeo } from '../src';

it('creates faq json-ld', () => {
  const data = buildSeo({
    slug: 'home',
    seo: {},
    blocks: [{ type: 'faq', title: 'FAQ', items: [{ question: 'Q?', answer: 'A' }] }]
  });
  expect(data.jsonLd[0]).toMatchObject({ '@type': 'FAQPage' });
});
