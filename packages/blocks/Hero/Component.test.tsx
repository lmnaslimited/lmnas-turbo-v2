import React from "react";
import { renderToString } from "react-dom/server";
import { describe, it, expect } from "vitest";
import { HeroBlockComponent } from "./Component";
import { heroBlockSchema } from "./schema";
import { getHeroMock } from "./mock";

const mockHeroBlock = getHeroMock();

describe("HeroBlock", () => {
    it("validates schema correctly", () => {
        const parsed = heroBlockSchema.safeParse(mockHeroBlock);
        expect(parsed.success).toBe(true);
    });

    it("renders correctly", () => {
        const html = renderToString(<HeroBlockComponent block={mockHeroBlock} />);

        // Check HTML contains elements based on mock data
        expect(html).toContain(mockHeroBlock.heading);
        expect(html).toContain(mockHeroBlock.subheading);
        expect(html).toContain(mockHeroBlock.ctaLabel);
    });
});
