import { z } from "zod";

const nullableOptionalString = z.preprocess((value) => (value === null ? undefined : value), z.string().min(1).optional());
const nullableOptionalEnum = <T extends [string, ...string[]]>(values: T) =>
  z.preprocess((value) => (value === null ? undefined : value), z.enum(values).optional());
const nullableOptionalObject = <T extends z.ZodRawShape>(shape: T) =>
  z.preprocess((value) => (value === null ? undefined : value), z.object(shape).optional());

export const contentPlanConversionConfigSchema = z.object({
  intent: z.enum(["book", "run_benefit", "download", "subscribe"]),
  eventName: z.string().min(1),
  eventCategory: nullableOptionalEnum(["conversion", "engagement", "navigation", "experiment"]),
  campaignId: nullableOptionalString,
  utmDefaults: nullableOptionalObject({
    source: nullableOptionalString,
    medium: nullableOptionalString,
    campaign: nullableOptionalString,
    content: nullableOptionalString,
    term: nullableOptionalString
  }),
  destination: nullableOptionalObject({
    type: z.enum(["url", "benefit", "asset", "form"]),
    value: z.string().min(1)
  }),
  benefitKey: nullableOptionalString
});

export const contentPlanSeoSchema = z.object({
  metaTitle: z.string().min(1),
  metaDescription: z.string().min(1),
  canonical: z.string().min(1),
  robots: z.string().min(1)
});

export const contentPlanPageTypeSchema = z.enum(["home", "product", "solution", "industry", "simple"]);
export const contentPlanLayoutKeySchema = z.enum([
  "homeLayout",
  "productLayout",
  "solutionLayout",
  "industryLayout",
  "simpleLayout"
]);

export const contentPlanSchema = z.object({
  page: z.object({
    slug: z.string().min(1),
    locale: z.string().min(1),
    sourceUrl: z.string().min(1),
    pageType: contentPlanPageTypeSchema,
    layoutKey: contentPlanLayoutKeySchema,
    conversionConfig: contentPlanConversionConfigSchema,
    seo: contentPlanSeoSchema
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
export type ContentPlanConversionConfig = z.infer<typeof contentPlanConversionConfigSchema>;
export type ContentPlanSeo = z.infer<typeof contentPlanSeoSchema>;

export function validateContentPlan(value: unknown): ContentPlan {
  return contentPlanSchema.parse(value);
}
