import { renderToString } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { PageRenderer } from '../src';

describe('PageRenderer', () => {
  it('renders valid blocks', () => {
    const html = renderToString(<PageRenderer blocks={[{ type: 'hero', title: 'Hello', subtitle: 'World' }]} />);
    expect(html).toContain('Hello');
  });

  it('shows validation error in preview mode', () => {
    const html = renderToString(<PageRenderer preview blocks={[{ type: 'faq', title: 'FAQ', items: [] } as any]} />);
    expect(html).toContain('Invalid faq block');
    expect(html).toContain('items');
  });
});
