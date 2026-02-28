export const blockFieldAllowlist: {
  scalar: { deny: string[] };
  nested: { relationNames: string[] };
  media: { fields: string[] };
} = {
  scalar: {
    deny: ["createdAt", "updatedAt"]
  },
  nested: {
    relationNames: ["items", "cta", "buttons", "links", "conversionConfig", "seo", "media", "image", "icon", "file"]
  },
  media: {
    fields: ["url", "alternativeText", "width", "height"]
  }
};
