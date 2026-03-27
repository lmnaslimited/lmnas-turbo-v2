import { z } from "zod";

const conversionIntentSchema = z.enum(["book", "run_benefit", "download", "subscribe"]);
const eventCategorySchema = z.enum(["conversion", "engagement", "navigation", "experiment"]);
const destinationTypeSchema = z.enum(["url", "benefit", "asset", "form"]);

const utmDefaultsSchema = z.object({
  source: z.string().min(1).optional(),
  medium: z.string().min(1).optional(),
  campaign: z.string().min(1).optional(),
  content: z.string().min(1).optional(),
  term: z.string().min(1).optional()
});

const destinationSchema = z.object({
  type: destinationTypeSchema,
  value: z.string().min(1)
});

export const conversionConfigSchema = z
  .object({
    intent: conversionIntentSchema,
    eventName: z.string().min(1),
    eventCategory: eventCategorySchema.optional(),
    campaignId: z.string().min(1).optional(),
    utmDefaults: utmDefaultsSchema.optional(),
    destination: destinationSchema.optional(),
    benefitKey: z.string().min(1).optional()
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
