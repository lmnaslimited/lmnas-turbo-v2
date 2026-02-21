module.exports = ({ env }) => {
  const siteUrl = env("CLIENT_URL", env("NEXT_PUBLIC_SITE_URL", "http://localhost:3000")).replace(/\/+$/, "");
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
        allowedOrigins: [siteUrl],
        async handler(uid, params) {
          const { documentId, locale, status } = params;
          const documents = strapi.documents(uid);
          const normalizedStatus = typeof status === "string" ? status.toLowerCase() : "";
          const statusCandidates = normalizedStatus === "published" ? ["published"] : ["draft", "published"];
          let document = null;

          for (const candidate of statusCandidates) {
            // Content Manager may send status "modified"; map non-published states to draft first.
            document = await documents.findOne({
              documentId,
              locale: locale || undefined,
              status: candidate
            });
            if (document) {
              break;
            }
          }

          if (!document) {
            return null;
          }

          const resolvedStatus = normalizedStatus === "published" ? "published" : "draft";

          if (uid === "api::page.page") {
            const path = buildSitePathForPage(document.slug);
            if (resolvedStatus === "published") {
              return `${siteUrl}${path}`;
            }
            return buildPreviewUrl(path);
          }

          if (uid === "api::blog-post.blog-post") {
            const path = `/blogs/${document.slug}`;
            if (resolvedStatus === "published") {
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
