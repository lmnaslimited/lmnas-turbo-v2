import { HeroBlockComponent, heroBlockSchema, FAQBlockComponent, faqBlockSchema } from "@lmnas/blocks";

export const blockRegistry = {
  hero: {
    component: HeroBlockComponent,
    schema: heroBlockSchema
  },
  faq: {
    component: FAQBlockComponent,
    schema: faqBlockSchema
  }
} as const;

export type BlockType = keyof typeof blockRegistry;
