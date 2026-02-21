module.exports = {
  async bootstrap({ strapi }) {
    const existing = await strapi.entityService.findMany("api::page.page", {
      filters: { slug: "home" },
      publicationState: "preview"
    });

    if (!existing || existing.length === 0) {
      await strapi.entityService.create("api::page.page", {
        data: {
          slug: "home",
          blocks: [
            {
              __component: "blocks.hero",
              heading: "Welcome to LMNAs",
              subheading: "Composable healthcare web platform",
              ctaLabel: "Get Started",
              ctaHref: "/start"
            },
            {
              __component: "blocks.faq",
              title: "Common Questions",
              items: [
                { question: "What is LMNAs Turbo v2?", answer: "A block-first web platform scaffold." },
                {
                  question: "How do I preview drafts?",
                  answer: "Use /preview?slug=home&token=local-preview-token"
                }
              ]
            }
          ],
          seo: {
            metaTitle: "LMNAs Home",
            metaDescription: "LMNAs platform home page",
            canonical: "http://localhost:3000",
            robots: "index,follow"
          },
          conversionConfig: {
            primary: "book",
            product: "platform",
            industry: "healthcare"
          },
          publishedAt: new Date().toISOString()
        }
      });
    }

    try {
      const publicRole = await strapi.query("plugin::users-permissions.role").findOne({
        where: { type: "public" }
      });

      if (!publicRole) {
        return;
      }

      const requiredActions = ["api::page.page.find", "api::page.page.findOne"];
      const permissionQuery = strapi.query("plugin::users-permissions.permission");

      for (const action of requiredActions) {
        const where = { action, role: publicRole.id };
        const existingPermission = await permissionQuery.findOne({ where });

        if (existingPermission) {
          if (existingPermission.enabled === false) {
            await permissionQuery.update({
              where: { id: existingPermission.id },
              data: { enabled: true }
            });
          }
          continue;
        }

        try {
          await permissionQuery.create({
            data: {
              action,
              role: publicRole.id,
              enabled: true
            }
          });
        } catch {
          await permissionQuery.create({
            data: {
              action,
              role: publicRole.id
            }
          });
        }
      }
    } catch (error) {
      strapi.log.warn(`Skipping auto-permission setup for Page API: ${error.message}`);
    }
  }
};
