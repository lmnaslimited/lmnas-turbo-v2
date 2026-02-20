import { z } from 'zod';

export const FaqItemSchema = z.object({
  question: z.string().min(1),
  answer: z.string().min(1)
});

export const FAQBlockSchema = z.object({
  type: z.literal('faq'),
  title: z.string().min(1),
  items: z.array(FaqItemSchema).min(1)
});

export type FAQBlock = z.infer<typeof FAQBlockSchema>;
