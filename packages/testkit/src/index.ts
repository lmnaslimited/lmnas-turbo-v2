export const homePageFixture = {
  slug: 'home',
  seo: { metaTitle: 'Home', metaDescription: 'Fixture home page' },
  blocks: [
    { type: 'hero', title: 'Welcome to LMNAS', subtitle: 'Fixture fallback content' },
    { type: 'faq', title: 'FAQ', items: [{ question: 'Is Strapi required?', answer: 'Not for fallback.' }] }
  ]
};
