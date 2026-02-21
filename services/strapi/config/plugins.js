module.exports = ({ env }) => {
  const clientUrl = env("CLIENT_URL", env("NEXT_PUBLIC_SITE_URL", "http://localhost:3000"));
  const previewSecret = env("STRAPI_PREVIEW_TOKEN", "");

  return {
    "preview-button": {
      config: {
        contentTypes: [
          {
            uid: "api::page.page",
            draft: {
              url: `${clientUrl}/api/preview`,
              query: {
                secret: previewSecret,
                slug: "{slug}"
              }
            },
            published: {
              url: `${clientUrl}/`,
              query: {}
            }
          }
        ]
      }
    }
  };
};
