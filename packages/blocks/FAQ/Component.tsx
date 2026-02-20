import React from "react";
import type { FAQBlock } from "./schema";

export function FAQBlockComponent({ block }: { block: FAQBlock }) {
  return (
    <section style={{ padding: 20, border: "1px solid #ddd", borderRadius: 8, marginBottom: 12 }}>
      <h2>{block.title}</h2>
      <ul>
        {block.items.map((item, idx) => (
          <li key={`${item.question}-${idx}`}>
            <strong>{item.question}</strong>
            <p>{item.answer}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}
