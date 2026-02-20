import type { HeroBlock } from './schema';

export function HeroComponent({ title, subtitle }: HeroBlock) {
  return (
    <section>
      <h2>{title}</h2>
      {subtitle ? <p>{subtitle}</p> : null}
    </section>
  );
}
