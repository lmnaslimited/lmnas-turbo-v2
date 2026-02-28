import { readFile } from "node:fs/promises";
import path from "node:path";
import { createGraphqlClient } from "../graphqlClient.js";

export type TypeRef = {
  kind: string;
  name?: string | null;
  ofType?: TypeRef | null;
};

export type IntrospectionArg = {
  name: string;
  type: TypeRef;
};

export type IntrospectionField = {
  name: string;
  args?: IntrospectionArg[] | null;
  type: TypeRef;
};

export type IntrospectionType = {
  kind: string;
  name?: string | null;
  fields?: IntrospectionField[] | null;
  possibleTypes?: Array<{ name?: string | null }> | null;
  inputFields?: Array<{ name: string; type: TypeRef }> | null;
  enumValues?: Array<{ name: string }> | null;
};

export type IntrospectionPayload = {
  data: {
    __schema: {
      queryType?: { name: string };
      mutationType?: { name: string };
      types: IntrospectionType[];
    };
  };
};

export const FULL_INTROSPECTION_QUERY = `
query IntrospectionQuery {
  __schema {
    queryType { name }
    mutationType { name }
    types {
      kind
      name
      fields {
        name
        args {
          name
          type {
            kind
            name
            ofType {
              kind
              name
              ofType {
                kind
                name
                ofType {
                  kind
                  name
                }
              }
            }
          }
        }
        type {
          kind
          name
          ofType {
            kind
            name
            ofType {
              kind
              name
              ofType {
                kind
                name
              }
            }
          }
        }
      }
      possibleTypes {
        name
      }
      inputFields {
        name
        type {
          kind
          name
          ofType {
            kind
            name
            ofType {
              kind
              name
              ofType {
                kind
                name
              }
            }
          }
        }
      }
      enumValues {
        name
      }
    }
  }
}
`;

export function unwrapType(typeRef: TypeRef): { kind: string; name?: string } {
  let cursor: TypeRef | null | undefined = typeRef;
  while (cursor && (cursor.kind === "NON_NULL" || cursor.kind === "LIST")) {
    cursor = cursor.ofType;
  }

  return {
    kind: cursor?.kind ?? "UNKNOWN",
    name: cursor?.name ?? undefined
  };
}

export function printType(typeRef: TypeRef): string {
  if (typeRef.kind === "NON_NULL" && typeRef.ofType) {
    return `${printType(typeRef.ofType)}!`;
  }
  if (typeRef.kind === "LIST" && typeRef.ofType) {
    return `[${printType(typeRef.ofType)}]`;
  }
  return typeRef.name ?? typeRef.kind;
}

export function typeMap(payload: IntrospectionPayload): Map<string, IntrospectionType> {
  const map = new Map<string, IntrospectionType>();
  for (const t of payload.data.__schema.types) {
    if (t.name) {
      map.set(t.name, t);
    }
  }
  return map;
}

export async function readIntrospectionFromDisk(rootDir: string): Promise<IntrospectionPayload> {
  const filePath = path.join(rootDir, "src/strapi/schema/introspection.json");
  const raw = await readFile(filePath, "utf8");
  return JSON.parse(raw) as IntrospectionPayload;
}

export async function fetchIntrospection(options: {
  strapiUrl: string;
  strapiToken: string;
  graphqlPath?: string;
}): Promise<IntrospectionPayload> {
  const client = createGraphqlClient({
    strapiUrl: options.strapiUrl,
    token: options.strapiToken,
    graphqlPath: options.graphqlPath
  });

  const data = await client.request<IntrospectionPayload["data"]>("IntrospectionQuery", FULL_INTROSPECTION_QUERY);
  return { data };
}
