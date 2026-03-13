import defaults from "./defaults.json";
import type { HeroBlock } from "./schema";

const heroDefaults = defaults as Omit<HeroBlock, "type">;

export function getHeroMock(): HeroBlock {
  return {
    type: "hero",
    ...heroDefaults
  };
}
