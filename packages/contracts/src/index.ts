import { HeroBlockSchema, FAQBlockSchema } from '@lmnas/blocks';
import { z } from 'zod';

export const BlockSchema = z.discriminatedUnion('type', [HeroBlockSchema, FAQBlockSchema]);

export const SeoSchema = z.object({
  metaTitle: z.string().optional(),
  metaDescription: z.string().optional(),
  canonical: z.string().optional(),
  robots: z.string().optional()
}).default({});

export const PageSchema = z.object({
  slug: z.string(),
  seo: SeoSchema,
  blocks: z.array(BlockSchema)
});

export const StrapiPageResponseSchema = z.object({
  data: z.object({
    attributes: z.object({
      slug: z.string(),
      seo: SeoSchema.optional(),
      blocks: z.array(z.any())
    })
  }).nullable()
});

export type Block = z.infer<typeof BlockSchema>;
export type Page = z.infer<typeof PageSchema>;
