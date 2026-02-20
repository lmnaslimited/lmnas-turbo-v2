import { PageSchema, StrapiPageResponseSchema, type Page } from '@lmnas/contracts';
import { homePageFixture } from '@lmnas/testkit';

export async function getPageBySlug(slug: string, options?: { preview?: boolean; token?: string }): Promise<Page> {
  const base = process.env.STRAPI_URL ?? 'http://localhost:1337';
  const state = options?.preview ? 'preview' : 'live';
  const url = `${base}/api/pages?filters[slug][$eq]=${slug}&publicationState=${state}&populate=deep`;

  try {
    const res = await fetch(url, {
      headers: options?.token ? { Authorization: `Bearer ${options.token}` } : undefined,
      cache: 'no-store'
    });
    if (!res.ok) throw new Error(`Strapi HTTP ${res.status}`);
    const payload = await res.json();
    const first = payload?.data?.[0]
      ? { data: { attributes: payload.data[0].attributes } }
      : payload;
    const parsed = StrapiPageResponseSchema.safeParse(first);
    if (!parsed.success || !parsed.data.data) throw new Error('Invalid strapi payload');
    return PageSchema.parse({
      slug: parsed.data.data.attributes.slug,
      seo: parsed.data.data.attributes.seo ?? {},
      blocks: (parsed.data.data.attributes.blocks ?? []).map((block: any) => ({
        type: block.__component?.split('.').pop() ?? block.type,
        ...block
      }))
    });
  } catch {
    return PageSchema.parse(homePageFixture);
  }
}

export async function track(eventName: string, payload: Record<string, unknown>) {
  if (process.env.NODE_ENV !== 'production') return;
  await fetch(process.env.RUDDER_URL ?? 'http://localhost:4011/track', {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ eventName, payload })
  });
}

export async function getLensAppointments() {
  const res = await fetch(`${process.env.LENS_API_URL ?? 'http://localhost:4010'}/appointments`);
  return res.json();
}
