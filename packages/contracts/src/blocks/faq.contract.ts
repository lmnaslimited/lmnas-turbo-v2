import { z } from "zod";
import type { BlockContract } from "./hero.contract";

export const faqSchema = z.object({
  type: z.literal("faq"),
  title: z.string().min(1),
  items: z.array(
    z.object({
      question: z.string().min(1),
      answer: z.string().optional()
    })
  )
});

export const faqContract: BlockContract = {
  type: "faq",
  meta: {
    strapi: {
      schemaPath: "services/strapi/src/components/blocks/faq.json",
      collectionName: "components_blocks_faqs",
      displayName: "faq"
    },
    governance: {
      phase: "M1",
      conversionBlock: false,
      requiresProductMapping: false,
      requiresConversionConfig: false,
      requiresPrimaryCta: false
    },
    editor: {
      allowedOnPageTypes: ["home", "product", "solution", "industry", "simple"]
    }
  },
  schema: faqSchema
};
