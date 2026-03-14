import React from "react";
import type { LayoutKey, Navigation, ShellAssignment } from "@lmnas/contracts";

export type ShellRenderModel = {
  assignment?: ShellAssignment;
  mainNavigation?: Navigation;
  footerNavigation?: Navigation;
  utilityNavigation?: Navigation;
};

type LayoutProps = {
  title: string;
  children: React.ReactNode;
  shell?: ShellRenderModel;
};

function resolveNavigationHref(item: { href?: string; destination?: { type: string; value: string } }): string | undefined {
  if (item.href) {
    return item.href;
  }

  if (item.destination?.type === "exit") {
    return "#";
  }

  if (item.destination?.value) {
    return item.destination.value;
  }

  return undefined;
}

function renderNavigationItems(items: Navigation["items"], depth = 0): React.ReactNode {
  return (
    <ul className={`lmnas-shell-nav-list lmnas-shell-nav-depth-${depth}`}>
      {items.map((item) => {
        const href = resolveNavigationHref(item);

        return (
          <li key={`${item.label}-${href ?? "group"}`} className="lmnas-shell-nav-item">
            {href ? (
              <a href={href} data-exit-id={item.destination?.exitId}>
                {item.label}
              </a>
            ) : (
              <span>{item.label}</span>
            )}
            {item.children && item.children.length > 0 && depth < 2 ? renderNavigationItems(item.children, depth + 1) : null}
          </li>
        );
      })}
    </ul>
  );
}

function ShellFrame({ shell, children }: { shell?: ShellRenderModel; children: React.ReactNode }) {
  const mainNavigation = shell?.mainNavigation;
  const footerNavigation = shell?.footerNavigation;
  const utilityNavigation = shell?.utilityNavigation;

  const hasMain = Boolean(mainNavigation && mainNavigation.items.length > 0);
  const hasFooter = Boolean(footerNavigation && footerNavigation.items.length > 0);
  const hasUtility = Boolean(utilityNavigation && utilityNavigation.items.length > 0);
  const hasAnyShell = hasMain || hasFooter || hasUtility;

  if (!hasAnyShell) {
    return <>{children}</>;
  }

  return (
    <div className="lmnas-shell-frame">
      {hasUtility ? (
        <div className="lmnas-shell-utility" aria-label="Utility navigation">
          {renderNavigationItems(utilityNavigation!.items)}
        </div>
      ) : null}
      <header className="lmnas-shell-header">
        {hasMain ? (
          <nav aria-label="Main navigation">{renderNavigationItems(mainNavigation!.items)}</nav>
        ) : (
          <div className="lmnas-shell-placeholder">No navbar assigned</div>
        )}
      </header>
      <main className="lmnas-shell-content">{children}</main>
      <footer className="lmnas-shell-footer">
        {hasFooter ? (
          <nav aria-label="Footer navigation">{renderNavigationItems(footerNavigation!.items)}</nav>
        ) : (
          <div className="lmnas-shell-placeholder">No footer assigned</div>
        )}
      </footer>
    </div>
  );
}

function governedLayout({ children, shell }: LayoutProps) {
  return <ShellFrame shell={shell}>{children}</ShellFrame>;
}

export const LayoutRegistry: Record<LayoutKey, (props: LayoutProps) => React.ReactNode> = {
  homeLayout: governedLayout,
  productLayout: governedLayout,
  solutionLayout: governedLayout,
  industryLayout: governedLayout,
  simpleLayout: governedLayout
};
