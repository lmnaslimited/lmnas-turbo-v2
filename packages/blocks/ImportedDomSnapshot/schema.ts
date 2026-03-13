import { z } from "zod";

export type SanitizedDomTextNode = {
  kind: "text";
  text: string;
};

export type SanitizedDomElementNode = {
  kind: "element";
  tag: string;
  attributes: Record<string, string>;
  children: SanitizedDomNode[];
};

export type SanitizedDomNode = SanitizedDomTextNode | SanitizedDomElementNode;

export type SanitizedDomRoot = {
  kind: "root";
  children: SanitizedDomNode[];
};

export const sanitizedDomNodeSchema: z.ZodType<SanitizedDomNode> = z.lazy(() =>
  z.union([
    z.object({
      kind: z.literal("text"),
      text: z.string()
    }),
    z.object({
      kind: z.literal("element"),
      tag: z.string().min(1),
      attributes: z.object({}).catchall(z.string()),
      children: z.array(sanitizedDomNodeSchema)
    })
  ])
);

export const sanitizedDomRootSchema: z.ZodType<SanitizedDomRoot> = z.object({
  kind: z.literal("root"),
  children: z.array(sanitizedDomNodeSchema)
});

export const importedDomSnapshotBlockSchema = z.object({
  type: z.literal("imported_dom_snapshot"),
  domJson: sanitizedDomRootSchema,
  classMap: z.object({}).catchall(z.string()),
  stylesheetRef: z.string().min(1)
});

export type ImportedDomSnapshotBlock = z.infer<typeof importedDomSnapshotBlockSchema>;
