"use client";

import React from "react";

export default function SiteError({ error, reset }: { error: Error; reset: () => void }) {
  const isStrapiUnreachable = error.message.includes("strapi_unreachable");

  return (
    <main>
      <h1 style={{ marginTop: 0 }}>Page Error</h1>
      {isStrapiUnreachable ? (
        <p>strapi_unreachable: Verify Strapi is running and GraphQL is enabled at /graphql.</p>
      ) : (
        <p>Unexpected error.</p>
      )}
      <button onClick={() => reset()} type="button">
        Retry
      </button>
    </main>
  );
}
