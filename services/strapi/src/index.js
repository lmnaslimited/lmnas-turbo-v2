module.exports = {
  async bootstrap({ strapi }) {
    const pages = [
      {
        slug: "home",
        pageType: "home",
        layoutKey: "homeLayout",
        conversionConfig: {
          primary: "book",
          product: "platform",
          industry: "healthcare"
        },
        blocks: [
          {
            __component: "blocks.hero",
            heading: "Welcome to LMNAs",
            subheading: "Composable healthcare web platform",
            ctaLabel: "Get Started",
            ctaHref: "/products/cpq"
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
        }
      },
      {
        slug: "products/cpq",
        pageType: "product",
        layoutKey: "productLayout",
        conversionConfig: {
          primary: "benefit",
          product: "cpq",
          industry: "healthcare"
        },
        blocks: [
          {
            __component: "blocks.hero",
            heading: "LMNAs CPQ",
            subheading: "Faster tender and quoting workflows",
            ctaLabel: "Talk to Sales",
            ctaHref: "/about"
          }
        ],
        seo: {
          metaTitle: "LMNAs CPQ",
          metaDescription: "Configure, price, quote for healthcare procurement teams.",
          canonical: "http://localhost:3000/products/cpq",
          robots: "index,follow"
        }
      },
      {
        slug: "solutions/tender-intelligence",
        pageType: "solution",
        layoutKey: "solutionLayout",
        conversionConfig: {
          primary: "download",
          product: "tender-intelligence",
          industry: "healthcare"
        },
        blocks: [
          {
            __component: "blocks.hero",
            heading: "Tender Intelligence",
            subheading: "Automate opportunity discovery and response quality",
            ctaLabel: "Download Brief",
            ctaHref: "/blogs/phase-0-baseline"
          }
        ],
        seo: {
          metaTitle: "Tender Intelligence",
          metaDescription: "AI-assisted tender insight for market access teams.",
          canonical: "http://localhost:3000/solutions/tender-intelligence",
          robots: "index,follow"
        }
      },
      {
        slug: "about",
        pageType: "simple",
        layoutKey: "simpleLayout",
        conversionConfig: {
          primary: "subscribe",
          product: "platform",
          industry: "healthcare"
        },
        blocks: [
          {
            __component: "blocks.hero",
            heading: "About LMNAs",
            subheading: "Built for healthcare commercialization teams",
            ctaLabel: "Subscribe",
            ctaHref: "/blogs"
          }
        ],
        seo: {
          metaTitle: "About LMNAs",
          metaDescription: "Company and platform background.",
          canonical: "http://localhost:3000/about",
          robots: "index,follow"
        }
      }
    ];

    for (const page of pages) {
      const existing = await strapi.entityService.findMany("api::page.page", {
        filters: { slug: page.slug },
        publicationState: "preview"
      });

      if (!existing || existing.length === 0) {
        await strapi.entityService.create("api::page.page", {
          data: {
            ...page,
            publishedAt: new Date().toISOString()
          }
        });
      }
    }

    const navigations = [
      {
        key: "main",
        items: [
          {
            label: "Products",
            children: [{ label: "CPQ", href: "/products/cpq" }]
          },
          {
            label: "Solutions",
            children: [{ label: "Tender Intelligence", href: "/solutions/tender-intelligence" }]
          },
          {
            label: "Industries",
            children: [{ label: "Healthcare", href: "/industries/healthcare" }]
          }
        ]
      },
      {
        key: "footer",
        items: [
          { label: "About", href: "/about" },
          { label: "Blogs", href: "/blogs" }
        ]
      }
    ];

    for (const navigation of navigations) {
      const existing = await strapi.entityService.findMany("api::navigation.navigation", {
        filters: { key: navigation.key },
        publicationState: "preview"
      });

      if (!existing || existing.length === 0) {
        await strapi.entityService.create("api::navigation.navigation", {
          data: {
            ...navigation,
            publishedAt: new Date().toISOString()
          }
        });
      }
    }

    const existingBlogPost = await strapi.entityService.findMany("api::blog-post.blog-post", {
      filters: { slug: "phase-0-baseline" },
      publicationState: "preview"
    });

    if (!existingBlogPost || existingBlogPost.length === 0) {
      await strapi.entityService.create("api::blog-post.blog-post", {
        data: {
          slug: "phase-0-baseline",
          title: "Phase 0 Baseline Upgrade",
          excerpt: "How LMNAs aligned the scaffold with Constitution v2.1.",
          body: "Phase 0 baseline content.",
          seo: {
            metaTitle: "Phase 0 Baseline Upgrade",
            metaDescription: "How LMNAs aligned the scaffold with Constitution v2.1.",
            canonical: "https://lmnas.com/blogs/phase-0-baseline",
            robots: "index,follow"
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

      const requiredActions = [
        "api::page.page.find",
        "api::page.page.findOne",
        "api::navigation.navigation.find",
        "api::navigation.navigation.findOne",
        "api::blog-post.blog-post.find",
        "api::blog-post.blog-post.findOne"
      ];
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
      strapi.log.warn(`Skipping auto-permission setup for public APIs: ${error.message}`);
    }
  }
};
