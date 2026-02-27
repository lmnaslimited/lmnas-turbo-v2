import { z } from "zod";

const conversionConfigSchema = z.object({
  intent: z.enum(["book", "run_benefit", "download", "subscribe"]),
  eventName: z.string().min(1),
  eventCategory: z.enum(["conversion", "engagement", "navigation", "experiment"]).optional(),
  campaignId: z.string().min(1).optional(),
  utmDefaults: z
    .object({
      source: z.string().min(1).optional(),
      medium: z.string().min(1).optional(),
      campaign: z.string().min(1).optional(),
      content: z.string().min(1).optional(),
      term: z.string().min(1).optional()
    })
    .optional(),
  destination: z
    .object({
      type: z.enum(["url", "benefit", "asset", "form"]),
      value: z.string().min(1)
    })
    .optional(),
  benefitKey: z.string().min(1).optional()
});

const seoSchema = z.object({
  metaTitle: z.string().min(1),
  metaDescription: z.string().min(1),
  canonical: z.string().min(1),
  robots: z.string().min(1)
});

const pageTypeSchema = z.enum(["home", "product", "solution", "industry", "simple"]);
const layoutKeySchema = z.enum(["homeLayout", "productLayout", "solutionLayout", "industryLayout", "simpleLayout"]);

export const contentPlanSchema = z.object({
  page: z.object({
    slug: z.string().min(1),
    locale: z.string().min(1),
    sourceUrl: z.string().min(1),
    pageType: pageTypeSchema,
    layoutKey: layoutKeySchema,
    conversionConfig: conversionConfigSchema,
    seo: seoSchema
  }),
  blocks: z.array(z.record(z.unknown())).min(1, "blocks required"),
  publish: z.object({
    state: z.enum(["draft", "published"])
  }),
  source: z.object({
    fetchedAt: z.string().min(1),
    schemaVersion: z.literal("content-plan.v1")
  })
});

export type ContentPlan = z.infer<typeof contentPlanSchema>;
export type ConversionConfig = z.infer<typeof conversionConfigSchema>;
export type SeoInput = z.infer<typeof seoSchema>;

export function validateContentPlan(value: unknown): ContentPlan {
  return contentPlanSchema.parse(value);
}
