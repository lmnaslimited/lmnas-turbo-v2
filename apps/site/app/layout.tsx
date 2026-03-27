import type { Metadata } from "next";
import React from "react";
import type { Navigation } from "@lmnas/contracts";
import { getNavigationByKey } from "@lmnas/integrations";

export const metadata: Metadata = {
  title: "LMNAs Turbo v2",
  description: "Block-based platform scaffold"
};

function renderNavItems(items: Navigation["items"]) {
  return items.map((item) => (
    <li key={`${item.label}-${item.href ?? "group"}`}>
      {item.href ? <a href={item.href}>{item.label}</a> : <span>{item.label}</span>}
      {item.children && item.children.length > 0 ? (
        <ul>
          {item.children.map((child) => (
            <li key={`${item.label}-${child.href}`}>
              <a href={child.href}>{child.label}</a>
            </li>
          ))}
        </ul>
      ) : null}
    </li>
  ));
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const [mainNavigation, footerNavigation] = await Promise.all([
    getNavigationByKey("main"),
    getNavigationByKey("footer")
  ]);

  return (
    <html lang="en">
      <body style={{ fontFamily: "system-ui, sans-serif", margin: 0, padding: 24 }}>
        <header>
          <nav aria-label="Main navigation">
            <ul>{renderNavItems(mainNavigation.items)}</ul>
          </nav>
        </header>
        {children}
        <footer>
          <nav aria-label="Footer navigation">
            <ul>{renderNavItems(footerNavigation.items)}</ul>
          </nav>
        </footer>
      </body>
    </html>
  );
}
