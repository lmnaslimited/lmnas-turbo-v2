export type GraphqlClientOptions = {
  strapiUrl: string;
  token: string;
  graphqlPath?: string;
};

export type GraphqlResponse<TData> = {
  data?: TData;
  errors?: Array<{ message?: string; path?: Array<string | number>; extensions?: Record<string, unknown> }>;
};

export class GraphqlRequestError extends Error {
  readonly status: number;
  readonly endpoint: string;
  readonly operationName: string;
  readonly body: string;

  constructor(status: number, endpoint: string, operationName: string, body: string) {
    super(`GraphQL request failed (${status}) for ${operationName} on ${endpoint}: ${body}`);
    this.name = "GraphqlRequestError";
    this.status = status;
    this.endpoint = endpoint;
    this.operationName = operationName;
    this.body = body;
  }
}

export class GraphqlOperationError extends Error {
  readonly endpoint: string;
  readonly operationName: string;
  readonly errors: Array<{ message?: string; path?: Array<string | number>; extensions?: Record<string, unknown> }>;

  constructor(
    endpoint: string,
    operationName: string,
    errors: Array<{ message?: string; path?: Array<string | number>; extensions?: Record<string, unknown> }>
  ) {
    super(`GraphQL operation failed for ${operationName} on ${endpoint}: ${JSON.stringify(errors)}`);
    this.name = "GraphqlOperationError";
    this.endpoint = endpoint;
    this.operationName = operationName;
    this.errors = errors;
  }
}

export function resolveGraphqlEndpoint(strapiUrl: string, graphqlPath = process.env.STRAPI_GRAPHQL_PATH ?? "/graphql"): string {
  const trimmedBase = strapiUrl.replace(/\/$/, "");
  const normalizedPath = graphqlPath.startsWith("/") ? graphqlPath : `/${graphqlPath}`;
  return `${trimmedBase}${normalizedPath}`;
}

export function createGraphqlClient(options: GraphqlClientOptions) {
  const endpoint = resolveGraphqlEndpoint(options.strapiUrl, options.graphqlPath);

  async function request<TData>(
    operationName: string,
    query: string,
    variables?: Record<string, unknown>
  ): Promise<TData> {
    let response: Response;
    try {
      response = await fetch(endpoint, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${options.token}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ operationName, query, variables })
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(`GraphQL request failed for ${operationName} on ${endpoint}: ${message}`);
    }

    const raw = await response.text();
    if (!response.ok) {
      throw new GraphqlRequestError(response.status, endpoint, operationName, raw);
    }

    let payload: GraphqlResponse<TData>;
    try {
      payload = JSON.parse(raw) as GraphqlResponse<TData>;
    } catch {
      throw new Error(`GraphQL response parse failed for ${operationName} on ${endpoint}: ${raw.slice(0, 500)}`);
    }

    if (payload.errors?.length) {
      throw new GraphqlOperationError(endpoint, operationName, payload.errors);
    }

    if (!payload.data) {
      throw new Error(`GraphQL response missing data for ${operationName} on ${endpoint}`);
    }

    return payload.data;
  }

  return {
    endpoint,
    request
  };
}

export async function preflight(options: GraphqlClientOptions): Promise<void> {
  if (!options.strapiUrl) {
    throw new Error("Missing STRAPI_URL. Set STRAPI_URL before running content importer commands.");
  }

  if (!options.token || options.token.length <= 20) {
    throw new Error("Missing or invalid STRAPI_TOKEN. Set STRAPI_TOKEN to a Strapi API token with write permissions.");
  }

  const client = createGraphqlClient(options);
  try {
    await client.request<{ __typename: string }>("Ping", "query Ping { __typename }");
  } catch (error) {
    if (error instanceof GraphqlRequestError && (error.status === 401 || error.status === 403)) {
      throw new Error(
        [
          `GraphQL preflight auth failed (${error.status}) on ${error.endpoint}.`,
          "Create/Use a Strapi API token with write permissions and set STRAPI_TOKEN.",
          `Response body: ${error.body}`
        ].join("\n")
      );
    }

    if (error instanceof GraphqlOperationError) {
      throw new Error(
        [
          `GraphQL preflight operation failed on ${error.endpoint}.`,
          "Create/Use a Strapi API token with write permissions and set STRAPI_TOKEN.",
          `Operation errors: ${JSON.stringify(error.errors)}`
        ].join("\n")
      );
    }

    throw error;
  }
}
