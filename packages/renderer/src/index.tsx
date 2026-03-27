import React from "react";
import { assertKnownBlockType, blockRegistry } from "@lmnas/block-registry";
import type { Block } from "@lmnas/contracts";
import { pageSchema } from "@lmnas/contracts";

function errorPath(error: { issues?: Array<{ path?: Array<string | number> }> }): string {
  const issue = error.issues?.[0];
  return issue?.path?.join(".") || "unknown";
}

function InvalidBlockPreview({ type, message }: { type: string; message: string }) {
  return (
    <div style={{ border: "1px solid #cc0000", background: "#fff0f0", padding: 12, marginBottom: 12 }}>
      <strong>Invalid block ({type})</strong>
      <p>{message}</p>
    </div>
  );
}

function InvalidBlockProduction({ type }: { type: string }) {
  return (
    <div style={{ border: "1px dashed #aaa", padding: 12, marginBottom: 12 }}>
      Block "{type}" was skipped because it is invalid.
    </div>
  );
}

export function renderValidatedBlock(block: unknown, preview = false): React.ReactElement | null {
  const type = typeof block === "object" && block && "type" in block ? String((block as { type: unknown }).type) : "unknown";
  assertKnownBlockType(type);
  const registryEntry = blockRegistry[type];

  const parsed = registryEntry.schema.safeParse(block);
  if (!parsed.success) {
    const message = `Validation failed at ${errorPath(parsed.error)}`;
    return preview ? <InvalidBlockPreview type={type} message={message} /> : <InvalidBlockProduction type={type} />;
  }

  const Component = registryEntry.component as React.ComponentType<{ block: Block }>;
  return <Component block={parsed.data as Block} />;
}

export function PageRenderer({ blocks, preview = false }: { blocks: unknown[]; preview?: boolean }) {
  return (
    <>
      {blocks.map((block, index) => {
        const rendered = renderValidatedBlock(block, preview);
        if (!rendered) {
          return null;
        }
        return <React.Fragment key={index}>{rendered}</React.Fragment>;
      })}
    </>
  );
}

export function validatePageInput(input: unknown) {
  return pageSchema.safeParse(input);
}
