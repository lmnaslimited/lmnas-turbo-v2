import React from "react";
import { renderToString } from "react-dom/server";
import { describe, it, expect } from "vitest";
import { FAQBlockComponent } from "./Component";
import { faqBlockSchema } from "./schema";
import { getFAQMock } from "./mock";

const mockFAQBlock = getFAQMock();

describe("FAQBlock", () => {
    it("validates schema correctly", () => {
        const parsed = faqBlockSchema.safeParse(mockFAQBlock);
        expect(parsed.success).toBe(true);
    });

    it("renders correctly", () => {
        const html = renderToString(<FAQBlockComponent block={mockFAQBlock} />);

        // Check HTML contains elements based on mock data
        expect(html).toContain(mockFAQBlock.title);
        if (mockFAQBlock.items.length > 0) {
            expect(html).toContain(mockFAQBlock.items[0].question);
            expect(html).toContain(mockFAQBlock.items[0].answer);
        }
    });
});
