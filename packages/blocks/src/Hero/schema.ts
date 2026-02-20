import { z } from 'zod';

export const HeroBlockSchema = z.object({
  type: z.literal('hero'),
  title: z.string().min(1),
  subtitle: z.string().optional().default('')
});

export type HeroBlock = z.infer<typeof HeroBlockSchema>;
