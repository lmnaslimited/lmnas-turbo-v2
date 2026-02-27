import { afterEach, describe, expect, it, vi } from "vitest";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { applyImportPlan, assertAllowlisted, buildStrapiPayload, createImportPlan } from "../src/index";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const fixturePath = path.resolve(__dirname, "../fixtures/home.html");

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("content-importer", () => {
  it("extracts hero fields into plan", async () => {
    const plan = await createImportPlan({
      htmlPath: fixturePath,
      slug: "home",
      locale: "en"
    });

    expect(plan.page.slug).toBe("home");
    expect(plan.blocks[0]?.type).toBe("hero");
    expect(plan.blocks[0]?.data.heading).toBe("AI-Driven Revenue Platform");
    expect(plan.blocks[0]?.data.ctaLabel).toBe("Book a Demo");
  });

  it("rejects unknown block types under Policy A", () => {
    expect(() => assertAllowlisted("unknown")).toThrowError("Block type not allowlisted by manifest");
  });

  it("builds correct Strapi payload for hero block", async () => {
    const plan = await createImportPlan({
      htmlPath: fixturePath,
      slug: "home",
      locale: "en"
    });

    const payload = buildStrapiPayload(plan);

    expect(payload.data.slug).toBe("home");
    const blocks = payload.data.blocks as Array<Record<string, unknown>>;
    expect(blocks[0]).toMatchObject({
      __component: "blocks.hero",
      heading: "AI-Driven Revenue Platform",
      ctaLabel: "Book a Demo",
      ctaHref: "/demo"
    });
  });

  it("applies plan with Strapi payload shape", async () => {
    const plan = await createImportPlan({
      htmlPath: fixturePath,
      slug: "home",
      locale: "en"
    });

    const fetchMock = vi.fn(async (input: unknown, init?: RequestInit) => {
      if (String(input).includes("/api/pages?")) {
        return new Response(JSON.stringify({ data: [] }), {
          status: 200,
          headers: { "content-type": "application/json" }
        });
      }

      if (String(input).includes("/api/pages")) {
        return new Response(JSON.stringify({ data: { id: 1 } }), {
          status: 200,
          headers: { "content-type": "application/json" }
        });
      }

      return new Response("not found", { status: 404 });
    });

    vi.stubGlobal("fetch", fetchMock);

    await applyImportPlan(plan, { strapiUrl: "http://localhost:1337", strapiToken: "token" });

    const writeCall = fetchMock.mock.calls.find((call) => String(call[0]).includes("/api/pages") && call[1]?.method === "POST");
    expect(writeCall).toBeTruthy();
    const payload = JSON.parse(String(writeCall?.[1]?.body ?? ""));
    expect(payload.data.blocks[0].__component).toBe("blocks.hero");
    expect(payload.data.blocks[0].heading).toBe("AI-Driven Revenue Platform");
  });
});
