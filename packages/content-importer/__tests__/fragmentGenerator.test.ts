import { describe, expect, it } from "vitest";
import { generateArtifactsFromIntrospection } from "../src/strapi/schema/generateArtifacts";

describe("fragment generator", () => {
  it("generates fragments for dynamic zone union", () => {
    const introspection = {
      data: {
        __schema: {
          types: [
            {
              kind: "OBJECT",
              name: "Page",
              fields: [
                {
                  name: "blocks",
                  type: {
                    kind: "NON_NULL",
                    ofType: {
                      kind: "LIST",
                      ofType: {
                        kind: "UNION",
                        name: "PageBlocksDynamicZone"
                      }
                    }
                  }
                }
              ]
            },
            {
              kind: "UNION",
              name: "PageBlocksDynamicZone",
              possibleTypes: [{ name: "ComponentBlocksHero" }, { name: "ComponentBlocksFaq" }]
            },
            {
              kind: "OBJECT",
              name: "ComponentBlocksHero",
              fields: [
                { name: "id", type: { kind: "SCALAR", name: "ID" } },
                { name: "heading", type: { kind: "SCALAR", name: "String" } },
                { name: "ctaLabel", type: { kind: "SCALAR", name: "String" } }
              ]
            },
            {
              kind: "OBJECT",
              name: "ComponentBlocksFaq",
              fields: [
                { name: "id", type: { kind: "SCALAR", name: "ID" } },
                { name: "title", type: { kind: "SCALAR", name: "String" } },
                { name: "items", type: { kind: "SCALAR", name: "JSON" } }
              ]
            }
          ]
        }
      }
    };

    const artifacts = generateArtifactsFromIntrospection(introspection as never);
    expect(artifacts.unionName).toBe("PageBlocksDynamicZone");
    expect(artifacts.componentTypes).toEqual(["ComponentBlocksHero", "ComponentBlocksFaq"]);
    expect(artifacts.fragmentBody).toMatchSnapshot();
  });

  it("does not force id for block types that do not expose id", () => {
    const introspection = {
      data: {
        __schema: {
          types: [
            {
              kind: "OBJECT",
              name: "Page",
              fields: [
                {
                  name: "blocks",
                  type: {
                    kind: "LIST",
                    ofType: {
                      kind: "UNION",
                      name: "PageBlocksDynamicZone"
                    }
                  }
                }
              ]
            },
            {
              kind: "UNION",
              name: "PageBlocksDynamicZone",
              possibleTypes: [{ name: "Error" }]
            },
            {
              kind: "OBJECT",
              name: "Error",
              fields: [
                { name: "message", type: { kind: "SCALAR", name: "String" } },
                { name: "code", type: { kind: "SCALAR", name: "String" } }
              ]
            }
          ]
        }
      }
    };

    const artifacts = generateArtifactsFromIntrospection(introspection as never);
    expect(artifacts.fragmentBody).toContain("... on Error {");
    expect(artifacts.fragmentBody).toContain("message");
    expect(artifacts.fragmentBody).toContain("code");
    expect(artifacts.fragmentBody).not.toContain("... on Error {\n    id");
  });
});
