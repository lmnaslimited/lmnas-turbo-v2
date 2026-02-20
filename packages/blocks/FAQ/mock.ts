import defaults from "./defaults.json";
import type { FAQBlock } from "./schema";

export function getFAQMock(): FAQBlock {
  return {
    type: "faq",
    ...defaults
  };
}
