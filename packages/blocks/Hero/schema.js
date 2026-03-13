import { z } from "zod";
const conversionIntentSchema = z.enum(["book", "run_benefit", "download", "subscribe"]);
const eventCategorySchema = z.enum(["conversion", "engagement", "navigation", "experiment"]);
const destinationTypeSchema = z.enum(["url", "benefit", "asset", "form"]);
const conversionConfigSchema = z
    .object({
    intent: conversionIntentSchema,
    eventName: z.string().min(1),
    eventCategory: eventCategorySchema.optional(),
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
        type: destinationTypeSchema,
        value: z.string().min(1)
    })
        .optional(),
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
const ctaSchema = z.object({
    label: z.string().min(1),
    href: z.string().min(1),
    exitId: z.string().min(1).optional()
});
const productMappingSchema = z.object({
    product: z.string().min(1),
    industry: z.string().min(1)
});
export const heroBlockSchema = z.object({
    type: z.literal("hero"),
    heading: z.string().min(1),
    subheading: z.string().min(1),
    productMapping: productMappingSchema,
    primaryCta: ctaSchema,
    secondaryCta: ctaSchema.optional(),
    ctaLabel: z.string().min(1).optional(),
    ctaHref: z.string().min(1).optional(),
    conversionConfig: conversionConfigSchema
});
