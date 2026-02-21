import { heroBlockSchema, faqBlockSchema } from "@lmnas/blocks";
import { z } from "zod";

export const blockSchema = z.union([heroBlockSchema, faqBlockSchema]);

export const seoSchema = z.object({
  metaTitle: z.string().min(1),
  metaDescription: z.string().min(1),
  canonical: z.string().url(),
  robots: z.string().min(1)
});

export const conversionConfigSchema = z.object({
  primary: z.enum(["book", "benefit", "download", "subscribe"]),
  product: z.string().min(1),
  industry: z.string().min(1)
});

export const pageSchema = z.object({
  id: z.number().optional(),
  slug: z.string().min(1),
  blocks: z.array(blockSchema),
  seo: seoSchema,
  conversionConfig: conversionConfigSchema
});

export const strapiPageAttributesSchema = z.object({
  slug: z.string(),
  blocks: z.array(z.unknown()),
  seo: z
    .object({
      metaTitle: z.string().min(1),
      metaDescription: z.string().min(1),
      canonical: z.string().url(),
      robots: z.string().min(1)
    })
    .optional(),
  conversionConfig: conversionConfigSchema.optional()
});

export const strapiPageItemSchema = z.object({
  id: z.number(),
  attributes: strapiPageAttributesSchema
});

export const strapiPageResponseSchema = z.object({
  data: z.array(strapiPageItemSchema)
});

export type Block = z.infer<typeof blockSchema>;
export type Page = z.infer<typeof pageSchema>;
export type Seo = z.infer<typeof seoSchema>;
export type ConversionConfig = z.infer<typeof conversionConfigSchema>;
export type StrapiPageResponse = z.infer<typeof strapiPageResponseSchema>;
