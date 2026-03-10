import React from "react";

export type StudioActionMenuItemTone = "neutral" | "accent" | "danger";

export type StudioActionMenuItem = {
  id: string;
  label: string;
  description?: string;
  tone?: StudioActionMenuItemTone;
  disabled?: boolean;
};

export type StudioActionMenuProps = {
  title: string;
  description?: string;
  items: StudioActionMenuItem[];
  emptyTitle?: string;
  emptyDescription?: string;
  testId?: string;
};

function resolveToneClass(tone: StudioActionMenuItemTone | undefined): string {
  if (tone === "danger") {
    return "border-red-500/30 bg-red-500/[0.08] text-red-200";
  }
  if (tone === "accent") {
    return "border-blue-500/30 bg-blue-500/[0.08] text-blue-200";
  }
  return "border-white/[0.08] bg-white/[0.02] text-slate-200";
}

export function StudioActionMenu(props: StudioActionMenuProps): React.ReactElement {
  const {
    title,
    description,
    items,
    emptyTitle = "No actions configured",
    emptyDescription = "Attach menu actions as workflows are implemented.",
    testId = "studio-action-menu"
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
          data-testid="studio-action-menu-empty"
          className="rounded-xl border border-dashed border-white/[0.12] bg-white/[0.015] px-3 py-5 text-center"
        >
          <p className="text-xs font-semibold text-slate-300">{emptyTitle}</p>
          <p className="mt-1 text-xs text-slate-500">{emptyDescription}</p>
        </div>
      ) : (
        <div className="space-y-2">
          {items.map((item) => (
            <button
              key={item.id}
              type="button"
              data-testid={`studio-action-${item.id}`}
              disabled={item.disabled}
              className={`w-full rounded-xl border px-3 py-2 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${resolveToneClass(
                item.tone
              )}`}
            >
              <p className="text-xs font-semibold">{item.label}</p>
              {item.description ? <p className="mt-0.5 text-[11px] text-slate-400">{item.description}</p> : null}
            </button>
          ))}
        </div>
      )}
    </section>
  );
}
