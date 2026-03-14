import { z } from "zod";

const conversionIntentSchema = z.enum(["book", "run_benefit", "download", "subscribe"]);
const eventCategorySchema = z.enum(["conversion", "engagement", "navigation", "experiment"]);
const destinationTypeSchema = z.enum(["url", "benefit", "asset", "form"]);
const nullableOptional = <T extends z.ZodTypeAny>(schema: T) =>
  z.preprocess((value) => (value === null ? undefined : value), schema.optional());

const utmDefaultsSchema = z.object({
  source: nullableOptional(z.string().min(1)),
  medium: nullableOptional(z.string().min(1)),
  campaign: nullableOptional(z.string().min(1)),
  content: nullableOptional(z.string().min(1)),
  term: nullableOptional(z.string().min(1))
});

const destinationSchema = z.object({
  type: destinationTypeSchema,
  value: z.string().min(1)
});

export const conversionConfigSchema = z
  .object({
    intent: conversionIntentSchema,
    eventName: z.string().min(1),
    eventCategory: nullableOptional(eventCategorySchema),
    campaignId: nullableOptional(z.string().min(1)),
    utmDefaults: nullableOptional(utmDefaultsSchema),
    destination: nullableOptional(destinationSchema),
    benefitKey: nullableOptional(z.string().min(1))
  })
  .superRefine((value, ctx) => {
    const needsBenefitKey = value.intent === "run_benefit" || value.destination?.type === "benefit";
    if (!needsBenefitKey || value.benefitKey) {
      return;
    }

    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "benefitKey is required when intent is run_benefit or destination.type is benefit",
      path: ["benefitKey"]
    });
  });

export type ConversionConfig = z.infer<typeof conversionConfigSchema>;

export interface SharedContract {
  meta: {
    strapi: {
      schemaPath: string;
      collectionName: string;
      displayName: string;
    };
  };
  schema: unknown;
}

export const conversionConfigContract: SharedContract = {
  meta: {
    strapi: {
      schemaPath: "services/strapi/src/components/shared/conversion-config.json",
      collectionName: "components_shared_conversion_configs",
      displayName: "conversionConfig"
    }
  },
  schema: conversionConfigSchema
};
