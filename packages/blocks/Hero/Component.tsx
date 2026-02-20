import React from "react";
import type { HeroBlock } from "./schema";

export function HeroBlockComponent({ block }: { block: HeroBlock }) {
  return (
    <section style={{ padding: 20, border: "1px solid #ddd", borderRadius: 8, marginBottom: 12 }}>
      <h2>{block.heading}</h2>
      <p>{block.subheading}</p>
      <a href={block.ctaHref}>{block.ctaLabel}</a>
    </section>
  );
}
