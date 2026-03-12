"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV_ITEMS = [
    { key: "import", label: "Import", href: "/platform/onboarding/import", icon: "download" },
    { key: "blocks", label: "Blocks", href: "/platform/onboarding/blocks", icon: "view_quilt" },
    { key: "pages", label: "Pages", href: "/platform/onboarding/pages", icon: "description" },
    { key: "widgets", label: "Widgets", href: "/platform/onboarding/widgets", icon: "extension" },
    { key: "theme-shell", label: "Theme & Shell", href: "/platform/onboarding/theme", icon: "palette" },
    { key: "publish", label: "Publish", href: "/platform/onboarding/publish", icon: "rocket_launch" }
] as const;

export function StudioSidebar() {
    const pathname = usePathname();
    const normalizedPath = pathname ?? "";
    const isThemeShellPath = normalizedPath.startsWith("/platform/onboarding/theme") || normalizedPath.startsWith("/platform/onboarding/shells");

    function isActive(href: string, key: string): boolean {
      if (key === "theme-shell") {
        return isThemeShellPath;
      }
      if (key === "import") {
        return normalizedPath.startsWith("/platform/onboarding/import");
      }
      return normalizedPath.startsWith(href);
    }

    return (
        <aside className="flex w-64 shrink-0 flex-col border-r border-white/[0.08] bg-[#0a1327]">
            <div className="border-b border-white/[0.08] px-4 py-5">
                <div className="flex items-center gap-3">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-500 text-white">
                        <span className="material-symbols-outlined text-[18px]">auto_awesome</span>
                    </div>
                    <div>
                        <p className="text-base font-bold tracking-tight text-slate-100">LMNAs Studio</p>
                        <p className="text-[11px] text-slate-500">Premium B2B SaaS</p>
                    </div>
                </div>
            </div>

            <nav className="flex flex-1 flex-col gap-1 px-2 py-4">
                {NAV_ITEMS.map((item) => {
                    const active = isActive(item.href, item.key);
                    return (
                        <Link
                            key={item.key}
                            href={item.href}
                            className={`relative flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                                active ? "bg-blue-500/[0.16] text-blue-300" : "text-slate-400 hover:bg-white/[0.05] hover:text-slate-200"
                            }`}
                        >
                            <span className={`material-symbols-outlined text-[20px] ${active ? "text-blue-300" : "text-slate-500"}`}>
                                {item.icon}
                            </span>
                            <span>{item.label}</span>
                            {active ? <span className="absolute left-0 top-1/2 h-5 w-[2px] -translate-y-1/2 rounded-r-full bg-blue-400" /> : null}
                        </Link>
                    );
                })}
            </nav>

            <div className="border-t border-white/[0.08] px-4 py-4">
                <div className="flex items-center gap-3 rounded-xl bg-white/[0.03] px-2 py-2">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-700 text-[11px] font-bold text-slate-200">
                        AR
                    </div>
                    <div className="min-w-0">
                        <p className="truncate text-xs font-semibold text-slate-200">Alex Rivera</p>
                        <p className="truncate text-[10px] text-slate-500">Admin</p>
                    </div>
                    <span className="material-symbols-outlined ml-auto text-[16px] text-slate-500">settings</span>
                </div>
            </div>
        </aside>
    );
}
