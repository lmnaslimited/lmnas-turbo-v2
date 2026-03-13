/* eslint-disable no-restricted-imports */
import { z } from "zod";

const nullableOptionalString = z.preprocess((value) => (value === null ? undefined : value), z.string().min(1).optional());
const nullableOptionalEnum = <T extends [string, ...string[]]>(values: T) =>
  z.preprocess((value) => (value === null ? undefined : value), z.enum(values).optional());
const nullableOptionalObject = <T extends z.ZodRawShape>(shape: T) =>
  z.preprocess((value) => (value === null ? undefined : value), z.object(shape).optional());

const conversionConfigSchema = z.object({
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

const seoSchema = z.object({
  metaTitle: z.string().min(1),
  metaDescription: z.string().min(1),
  canonical: z.string().min(1),
  robots: z.string().min(1)
});

const pageTypeSchema = z.enum(["home", "product", "solution", "industry", "simple"]);
const layoutKeySchema = z.enum(["homeLayout", "productLayout", "solutionLayout", "industryLayout", "simpleLayout"]);
const sectionModeSchema = z.enum(["strict", "snapshot"]);
const fidelityStatusSchema = z.enum(["pending", "pass", "fail", "forced"]);

const confidenceMetricsSchema = z.object({
  recognizedNodeRatio: z.number().min(0).max(1),
  mappedStyleRatio: z.number().min(0).max(1),
  unsupportedSelectorPenalty: z.number().min(0).max(0.15),
  inlineStylePenalty: z.number().min(0).max(0.15)
});

const importModeSectionSchema = z.object({
  sectionKey: z.string().min(1),
  mode: sectionModeSchema,
  confidence: z.number().min(0).max(1),
  metrics: confidenceMetricsSchema
});

const themeFidelityMetricSchema = z.object({
  diffRatio: z.number().min(0).max(1),
  withinThreshold: z.boolean(),
  durationMs: z.number().min(0)
});

const themeFidelityRunSchema = z.object({
  themeKey: z.string().min(1),
  screenshotPath: z.string().min(1),
  metric: themeFidelityMetricSchema
});

const fidelitySummarySchema = z.object({
  themeCount: z.number().int().min(0),
  failedThemes: z.array(z.string().min(1)),
  averageDiffRatio: z.number().min(0).max(1),
  maxDiffRatio: z.number().min(0).max(1)
});

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
    schemaVersion: z.literal("content-plan.v1"),
    theme: z
      .object({
        themeKey: z.string().min(1),
        themeScopeClass: z.string().min(1)
      })
      .optional(),
    importMode: z
      .object({
        mode: z.literal("auto"),
        threshold: z.number().min(0).max(1),
        sections: z.array(importModeSectionSchema).min(1),
        summary: z.object({
          strictCount: z.number().int().min(0),
          snapshotCount: z.number().int().min(0)
        })
      })
      .optional(),
    fidelity: z
      .object({
        threshold: z.number().min(0).max(1),
        status: fidelityStatusSchema,
        forced: z.boolean().optional(),
        artifactPath: z.string().min(1).optional(),
        runs: z.array(themeFidelityRunSchema).optional(),
        summary: fidelitySummarySchema.optional()
      })
      .optional()
  })
});

export type ContentPlan = z.infer<typeof contentPlanSchema>;
export type ConversionConfig = z.infer<typeof conversionConfigSchema>;
export type SeoInput = z.infer<typeof seoSchema>;

export function validateContentPlan(value: unknown): ContentPlan {
  return contentPlanSchema.parse(value);
}
