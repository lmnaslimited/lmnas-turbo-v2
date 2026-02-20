import defaults from "./defaults.json";
import type { HeroBlock } from "./schema";

export function getHeroMock(): HeroBlock {
  return {
    type: "hero",
    ...defaults
  };
}
