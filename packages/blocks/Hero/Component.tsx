import React from "react";
import type { HeroBlock } from "./schema";

export function HeroBlockComponent({ block }: { block: HeroBlock }) {
  const ctaLabel = block.primaryCta.label;
  const ctaHref = block.primaryCta.href;

  return (
    <section className="lmnas-hero-block">
      <h2>{block.heading}</h2>
      <p>{block.subheading}</p>
      <a href={ctaHref} data-exit-id={block.primaryCta.exitId}>
        {ctaLabel}
      </a>
    </section>
  );
}
