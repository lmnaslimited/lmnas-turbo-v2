import { blockRegistry } from '@lmnas/block-registry';
import type { Block } from '@lmnas/contracts';

export function PageRenderer({ blocks, preview = false }: { blocks: Block[]; preview?: boolean }) {
  return (
    <>
      {blocks.map((block, idx) => {
        const entry = blockRegistry[block.type as keyof typeof blockRegistry];
        if (!entry) {
          return preview ? <pre key={idx}>Unknown block type: {(block as any).type}</pre> : <div key={idx}>Unsupported block</div>;
        }
        const parsed = entry.schema.safeParse(block);
        if (!parsed.success) {
          const issue = parsed.error.issues[0];
          return preview
            ? <pre key={idx}>Invalid {block.type} block at {issue.path.join('.')}: {issue.message}</pre>
            : <div key={idx}>Skipped invalid block</div>;
        }
        const Component = entry.component as any;
        return <Component key={idx} {...parsed.data} />;
      })}
    </>
  );
}
