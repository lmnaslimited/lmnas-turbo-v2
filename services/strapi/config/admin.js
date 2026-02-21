module.exports = ({ env }) => {
  const siteUrl = env("NEXT_PUBLIC_SITE_URL", "http://localhost:3000");
  const previewSecret = env("PREVIEW_SECRET", env("STRAPI_PREVIEW_TOKEN", "local-preview-token"));

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
        async handler(uid, { documentId, status }) {
          if (uid !== "api::page.page") {
            return null;
          }

          const document = await strapi.documents(uid).findOne({ documentId });
          if (!document || !document.slug) {
            return null;
          }

          const slug = encodeURIComponent(document.slug);
          const previewStatus = status === "published" ? "published" : "draft";
          return `${siteUrl}/preview?slug=${slug}&token=${previewSecret}&status=${previewStatus}`;
        }
      }
    }
  };
};
