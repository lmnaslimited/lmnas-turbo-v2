import { z } from "zod";

export const heroBlockSchema = z.object({
  type: z.literal("hero"),
  heading: z.string().min(1),
  subheading: z.string().min(1),
  ctaLabel: z.string().min(1),
  ctaHref: z.string().min(1)
});

export type HeroBlock = z.infer<typeof heroBlockSchema>;
