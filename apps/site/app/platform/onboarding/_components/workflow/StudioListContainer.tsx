import React from "react";

export type StudioListContainerProps<TItem extends { id: string }> = {
  title: string;
  description?: string;
  items: TItem[];
  selectedId?: string | null;
  getItemTitle: (item: TItem) => string;
  getItemSubtitle?: (item: TItem) => string;
  getItemMeta?: (item: TItem) => string;
  onSelectItem?: (item: TItem) => void;
  getItemTestId?: (item: TItem) => string | undefined;
  emptyTitle?: string;
  emptyDescription?: string;
  testId?: string;
};

export function StudioListContainer<TItem extends { id: string }>(props: StudioListContainerProps<TItem>): React.ReactElement {
  const {
    title,
    description,
    items,
    selectedId,
    getItemTitle,
    getItemSubtitle,
    getItemMeta,
    onSelectItem,
    getItemTestId,
    emptyTitle = "No records yet",
    emptyDescription = "Items from future workflows will appear here.",
    testId = "studio-list-container"
  } = props;

  return (
    <section
      data-testid={testId}
      className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-4 shadow-[0_20px_45px_rgba(7,10,20,0.18)]"
    >
      <header className="mb-3 border-b border-white/[0.06] pb-3">
        <h2 className="text-sm font-semibold text-slate-100">{title}</h2>
        {description ? <p className="mt-1 text-xs leading-relaxed text-slate-500">{description}</p> : null}
      </header>

      {items.length === 0 ? (
        <div
          data-testid="studio-list-empty"
          className="rounded-xl border border-dashed border-white/[0.12] bg-white/[0.015] px-3 py-5 text-center"
        >
          <p className="text-xs font-semibold text-slate-300">{emptyTitle}</p>
          <p className="mt-1 text-xs text-slate-500">{emptyDescription}</p>
        </div>
      ) : (
        <ul className="space-y-2">
          {items.map((item) => {
            const itemTitle = getItemTitle(item);
            const subtitle = getItemSubtitle ? getItemSubtitle(item) : undefined;
            const meta = getItemMeta ? getItemMeta(item) : undefined;
            const isSelected = selectedId === item.id;
            const testIdForItem = getItemTestId ? getItemTestId(item) : undefined;
            return (
              <li
                key={item.id}
                data-testid={testIdForItem}
                className={`rounded-xl border px-3 py-2.5 ${
                  isSelected
                    ? "border-blue-500/35 bg-blue-500/[0.09]"
                    : "border-white/[0.07] bg-white/[0.015]"
                }`}
              >
                {onSelectItem ? (
                  <button
                    type="button"
                    className="w-full text-left"
                    onClick={() => onSelectItem(item)}
                  >
                    <p className="text-xs font-semibold text-slate-200">{itemTitle}</p>
                    {subtitle ? <p className="mt-0.5 text-xs text-slate-500">{subtitle}</p> : null}
                    {meta ? <p className="mt-1 text-[11px] text-slate-600">{meta}</p> : null}
                  </button>
                ) : (
                  <>
                    <p className="text-xs font-semibold text-slate-200">{itemTitle}</p>
                    {subtitle ? <p className="mt-0.5 text-xs text-slate-500">{subtitle}</p> : null}
                    {meta ? <p className="mt-1 text-[11px] text-slate-600">{meta}</p> : null}
                  </>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
