module.exports = {
  async bootstrap({ strapi }) {
    const existing = await strapi.entityService.findMany('api::page.page', { filters: { slug: 'home' } });
    if (existing.length > 0) return;

    await strapi.entityService.create('api::page.page', {
      data: {
        slug: 'home',
        seo: { metaTitle: 'LMNAS Home', metaDescription: 'Welcome to LMNAS platform' },
        blocks: [
          { __component: 'blocks.hero', title: 'LMNAS Turbo v2', subtitle: 'Powered by Strapi blocks' },
          { __component: 'blocks.faq', title: 'Platform FAQ', items: [{ question: 'What works?', answer: 'Renderer + preview + SEO.' }] }
        ]
      }
    });
  }
};
