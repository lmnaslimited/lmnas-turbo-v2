import type { Metadata } from "next";
import type { StudioRuntimePage } from "./studio-page-runtime";

export function buildMetadataFromSeo(meta: {
  title?: string;
  description?: string;
  canonical?: string;
  robots?: string;
}): Metadata {
  return {
    ...(meta.title ? { title: meta.title } : {}),
    ...(meta.description ? { description: meta.description } : {}),
    ...(meta.canonical
      ? {
          alternates: {
            canonical: meta.canonical
          }
        }
      : {}),
    ...(meta.robots ? { robots: meta.robots } : {})
  };
}

export function buildStudioRuntimeMetadata(page: Pick<StudioRuntimePage, "seoMetadata" | "canonicalUrl">): Metadata {
  return {
    title: page.seoMetadata.metaTitle,
    description: page.seoMetadata.metaDescription,
    alternates: {
      canonical: page.canonicalUrl
    },
    robots: "index,follow"
  };
}
