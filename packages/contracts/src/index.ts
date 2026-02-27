import { heroBlockSchema, faqBlockSchema } from "@lmnas/blocks";
import { z } from "zod";
import { conversionConfigSchema as sharedConversionConfigSchema } from "./shared";
export { heroContract, faqContract } from "./blocks";
export type { BlockContract, BlockContractMeta, ContractPageType } from "./blocks";
export { conversionConfigContract } from "./shared";
export { sharedConversionConfigSchema };
export type { ConversionConfig as SharedConversionConfig } from "./shared";

export const blockSchema = z.union([heroBlockSchema, faqBlockSchema]);

export const pageTypeSchema = z.enum(["home", "product", "solution", "industry", "simple"]);
export const layoutKeySchema = z.enum([
  "homeLayout",
  "productLayout",
  "solutionLayout",
  "industryLayout",
  "simpleLayout"
]);

export const conversionConfigSchema = sharedConversionConfigSchema;

export const seoSchema = z.object({
  metaTitle: z.string().min(1),
  metaDescription: z.string().min(1),
  canonical: z.string().min(1),
  robots: z.string().min(1)
});

export const pageSchema = z.object({
  id: z.number().optional(),
  slug: z.string().min(1),
  pageType: pageTypeSchema,
  layoutKey: layoutKeySchema,
  blocks: z.array(blockSchema),
  seo: seoSchema
});

export const strapiPageAttributesSchema = z.object({
  slug: z.string(),
  pageType: pageTypeSchema,
  layoutKey: layoutKeySchema,
  blocks: z.array(z.unknown()),
  seo: seoSchema
});

export const strapiPageItemSchema = z.object({
  id: z.number(),
  attributes: strapiPageAttributesSchema
});

export const strapiPageResponseSchema = z.object({
  data: z.array(strapiPageItemSchema)
});

const navigationChildItemSchema = z.object({
  label: z.string().min(1),
  href: z.string().min(1)
});

export const navigationItemSchema = z.object({
  label: z.string().min(1),
  href: z.string().optional(),
  children: z.array(navigationChildItemSchema).max(12).optional()
});

export const navigationSchema = z.object({
  id: z.number().optional(),
  key: z.enum(["main", "footer"]),
  items: z.array(navigationItemSchema).max(50)
});

export const blogPostSchema = z.object({
  id: z.number().optional(),
  slug: z.string().min(1),
  title: z.string().min(1),
  excerpt: z.string().min(1),
  body: z.string().min(1),
  seo: seoSchema,
  publishedAt: z.string().optional()
});

export type Block = z.infer<typeof blockSchema>;
export type Page = z.infer<typeof pageSchema>;
export type Seo = z.infer<typeof seoSchema>;
export type StrapiPageResponse = z.infer<typeof strapiPageResponseSchema>;
export type ConversionConfig = z.infer<typeof conversionConfigSchema>;
export type PageType = z.infer<typeof pageTypeSchema>;
export type LayoutKey = z.infer<typeof layoutKeySchema>;
export type Navigation = z.infer<typeof navigationSchema>;
export type BlogPost = z.infer<typeof blogPostSchema>;
