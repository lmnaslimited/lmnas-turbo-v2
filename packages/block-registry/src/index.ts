import { HeroComponent, HeroBlockSchema, FAQComponent, FAQBlockSchema } from '@lmnas/blocks';

export const blockRegistry = {
  hero: { component: HeroComponent, schema: HeroBlockSchema },
  faq: { component: FAQComponent, schema: FAQBlockSchema }
} as const;
