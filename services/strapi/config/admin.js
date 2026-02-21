module.exports = ({ env }) => {
  const siteUrl = env("CLIENT_URL", env("NEXT_PUBLIC_SITE_URL", "http://localhost:3000"));
  const previewSecret = env("PREVIEW_SECRET", env("STRAPI_PREVIEW_TOKEN", "local-preview-token"));

  const buildSitePathForPage = (slug) => {
    const normalizedSlug = typeof slug === "string" ? slug.trim().replace(/^\/+|\/+$/g, "") : "";
    if (!normalizedSlug || normalizedSlug === "home") {
      return "/";
    }
    return `/${normalizedSlug}`;
  };

  const buildPreviewUrl = (path) =>
    `${siteUrl}/api/preview?url=${encodeURIComponent(path)}&secret=${encodeURIComponent(previewSecret)}`;

  return {
    auth: {
      secret: env("ADMIN_JWT_SECRET", "adminJwtSecret")
    },
    apiToken: {
      salt: env("API_TOKEN_SALT", "apiTokenSalt")
    },
    transfer: {
      token: {
        salt: env("TRANSFER_TOKEN_SALT", "transferTokenSalt")
      }
    },
    preview: {
      enabled: true,
      config: {
        async handler(uid, params) {
          const { documentId, locale, status } = params;
          const targetStatus = status === "published" ? "published" : "draft";
          const documents = strapi.documents(uid);
          const document = await documents.findOne({
            documentId,
            locale: locale || undefined,
            status: targetStatus
          });

          if (!document) {
            return null;
          }

          if (uid === "api::page.page") {
            const path = buildSitePathForPage(document.slug);
            if (targetStatus === "published") {
              return `${siteUrl}${path}`;
            }
            return buildPreviewUrl(path);
          }

          if (uid === "api::blog-post.blog-post") {
            const path = `/blogs/${document.slug}`;
            if (targetStatus === "published") {
              return `${siteUrl}${path}`;
            }
            return buildPreviewUrl(path);
          }

          return null;
        }
      }
    }
  };
};
