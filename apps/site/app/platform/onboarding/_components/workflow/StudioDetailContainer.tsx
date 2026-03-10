import React from "react";

export type StudioDetailContainerProps = {
  title: string;
  description?: string;
  isEmpty: boolean;
  emptyTitle?: string;
  emptyDescription?: string;
  headerSlot?: React.ReactNode;
  children?: React.ReactNode;
  testId?: string;
};

export function StudioDetailContainer(props: StudioDetailContainerProps): React.ReactElement {
  const {
    title,
    description,
    isEmpty,
    emptyTitle = "No item selected",
    emptyDescription = "Select an item from the list to inspect details.",
    headerSlot,
    children,
    testId = "studio-detail-container"
  } = props;

  return (
    <section
      data-testid={testId}
      className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-4 shadow-[0_20px_45px_rgba(7,10,20,0.18)]"
    >
      <header className="mb-3 flex items-start justify-between gap-3 border-b border-white/[0.06] pb-3">
        <div>
          <h2 className="text-sm font-semibold text-slate-100">{title}</h2>
          {description ? <p className="mt-1 text-xs leading-relaxed text-slate-500">{description}</p> : null}
        </div>
        {headerSlot ? <div className="shrink-0">{headerSlot}</div> : null}
      </header>

      {isEmpty ? (
        <div
          data-testid="studio-detail-empty"
          className="rounded-xl border border-dashed border-white/[0.12] bg-white/[0.015] px-3 py-8 text-center"
        >
          <p className="text-xs font-semibold text-slate-300">{emptyTitle}</p>
          <p className="mt-1 text-xs text-slate-500">{emptyDescription}</p>
        </div>
      ) : (
        <div className="space-y-3">{children}</div>
      )}
    </section>
  );
}
