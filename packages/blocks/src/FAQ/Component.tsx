import type { FAQBlock } from './schema';

export function FAQComponent({ title, items }: FAQBlock) {
  return (
    <section>
      <h2>{title}</h2>
      <ul>
        {items.map((item) => (
          <li key={item.question}>
            <strong>{item.question}</strong>
            <p>{item.answer}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}
