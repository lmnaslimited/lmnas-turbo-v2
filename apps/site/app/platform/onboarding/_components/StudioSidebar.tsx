"use client";

import React, { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV_ITEMS = [
    { key: "theme", label: "Theme", href: "/platform/onboarding/theme", icon: "palette" },
    { key: "blocks", label: "Blocks", href: "/platform/onboarding/blocks", icon: "dashboard_customize" },
    { key: "shells", label: "Shells", href: "/platform/onboarding/shells", icon: "web" },
    { key: "publish", label: "Publish", href: "/platform/onboarding/publish", icon: "publish" },
    { key: "pages", label: "Pages", href: "/platform/onboarding/pages", icon: "article" },
    { key: "widgets", label: "Widgets", href: "/platform/onboarding/widgets", icon: "extension" }
] as const;

export function StudioSidebar() {
    const pathname = usePathname();
    const [collapsed, setCollapsed] = useState(false);

    return (
        <aside className={`flex flex-col border-r border-white/[0.06] bg-[#0d1321] transition-all duration-300 ${collapsed ? "w-[56px]" : "w-[200px]"}`}>
            {/* Header */}
            <div className="flex items-center justify-between border-b border-white/[0.06] px-3 py-3">
                {!collapsed && (
                    <span className="text-xs font-bold text-slate-300 tracking-tight">Studio</span>
                )}
                <button
                    type="button"
                    onClick={() => setCollapsed((prev) => !prev)}
                    className="flex items-center justify-center w-7 h-7 rounded-lg hover:bg-white/[0.06] text-slate-500 hover:text-slate-300 transition-colors cursor-pointer"
                    title={collapsed ? "Expand" : "Collapse"}
                >
                    <span className="material-symbols-outlined text-base">
                        {collapsed ? "chevron_right" : "chevron_left"}
                    </span>
                </button>
            </div>

            {/* Navigation */}
            <nav className="flex flex-col gap-0.5 px-2 py-2 flex-1">
                {NAV_ITEMS.map((item) => {
                    const isActive = pathname.startsWith(item.href);
                    return (
                        <Link
                            key={item.key}
                            href={item.href}
                            className={`flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-xs font-medium transition-all relative ${isActive
                                    ? "bg-blue-500/[0.1] text-blue-400"
                                    : "text-slate-500 hover:bg-white/[0.04] hover:text-slate-300"
                                }`}
                            title={collapsed ? item.label : undefined}
                        >
                            <span className={`material-symbols-outlined text-lg ${isActive ? "text-blue-400" : "text-slate-600"}`}>
                                {item.icon}
                            </span>
                            {!collapsed && <span>{item.label}</span>}
                            {isActive && <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[2px] h-4 rounded-r-full bg-blue-400" />}
                        </Link>
                    );
                })}
            </nav>

            {/* Footer */}
            <div className="border-t border-white/[0.06] px-2 py-2">
                <Link
                    href="/platform/onboarding"
                    className="flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-xs text-slate-600 hover:text-slate-400 hover:bg-white/[0.04] transition-colors"
                    title={collapsed ? "Home" : undefined}
                >
                    <span className="material-symbols-outlined text-lg">home</span>
                    {!collapsed && <span>Home</span>}
                </Link>
            </div>
        </aside>
    );
}
