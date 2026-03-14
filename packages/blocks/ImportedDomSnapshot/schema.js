import { z } from "zod";
export const sanitizedDomNodeSchema = z.lazy(() => z.union([
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
]));
export const sanitizedDomRootSchema = z.object({
    kind: z.literal("root"),
    children: z.array(sanitizedDomNodeSchema)
});
export const importedDomSnapshotBlockSchema = z.object({
    type: z.literal("imported_dom_snapshot"),
    domJson: sanitizedDomRootSchema,
    classMap: z.object({}).catchall(z.string()),
    stylesheetRef: z.string().min(1)
});
