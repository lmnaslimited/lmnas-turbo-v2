import { z } from "zod";

export const faqItemSchema = z.object({
  question: z.string().min(1),
  answer: z.string().min(1)
});

export const faqBlockSchema = z.object({
  type: z.literal("faq"),
  title: z.string().min(1),
  items: z.array(faqItemSchema).min(1)
});

export type FAQBlock = z.infer<typeof faqBlockSchema>;
