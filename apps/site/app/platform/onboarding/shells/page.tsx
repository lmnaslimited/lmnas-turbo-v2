"use client";

import React, { useEffect, useState } from "react";

/* ─── Data Model ─── */

interface ShellAction {
    id: string;
    label: string;
    type: "link_url" | "scroll_to_section" | "open_modal" | "open_drawer";
    target: string;
}

interface MenuItem {
    id: string;
    label: string;
    href: string;
    children?: MenuItem[];
}

interface ShellVariant {
    id: string;
    name: string;
    role: "navbar" | "footer";
    status: "active" | "inactive";
    updatedAt: string;
    menuItems: MenuItem[];
    actions: ShellAction[];
    previewHtml: string;
}

const ACTION_TYPES = [
    { value: "link_url", label: "Navigate to URL" },
    { value: "scroll_to_section", label: "Scroll to section" },
    { value: "open_modal", label: "Open modal" },
    { value: "open_drawer", label: "Open drawer" }
];

/* ─── Seed shells ─── */

function loadShells(): ShellVariant[] {
    if (typeof window === "undefined") return [];
    const raw = localStorage.getItem("lmnas-shells");
    if (raw) { try { return JSON.parse(raw); } catch { /* fall through */ } }
    const seed: ShellVariant[] = [
        {
            id: "navbar-main",
            name: "Main Navbar",
            role: "navbar",
            status: "active",
            updatedAt: "2026-03-09",
            menuItems: [
                { id: "m1", label: "Products", href: "/products" },
                {
                    id: "m2", label: "Solutions", href: "/solutions", children: [
                        { id: "m2a", label: "Enterprise", href: "/solutions/enterprise" },
                        { id: "m2b", label: "Startups", href: "/solutions/startups" }
                    ]
                },
                { id: "m3", label: "Pricing", href: "/pricing" },
                { id: "m4", label: "Blog", href: "/blog" }
            ],
            actions: [
                { id: "a1", label: "Book Demo", type: "open_modal", target: "#book-demo" },
                { id: "a2", label: "Sign In", type: "link_url", target: "/login" }
            ],
            previewHtml: `<nav style="display:flex;justify-content:space-between;align-items:center;padding:14px 28px;background:#0f172a;color:#f8fafc;font-family:system-ui"><strong style="font-size:16px;letter-spacing:-0.4px">LMNAs</strong><div style="display:flex;gap:20px"><a href="#" style="color:#94a3b8;text-decoration:none;font-size:13px">Products</a><a href="#" style="color:#94a3b8;text-decoration:none;font-size:13px">Solutions</a><a href="#" style="color:#94a3b8;text-decoration:none;font-size:13px">Pricing</a><a href="#" style="color:#94a3b8;text-decoration:none;font-size:13px">Blog</a></div><div style="display:flex;gap:8px"><button style="background:transparent;border:1px solid #334155;color:#94a3b8;padding:6px 14px;border-radius:6px;font-size:12px;cursor:pointer">Sign In</button><button style="background:#3b82f6;border:none;color:white;padding:6px 14px;border-radius:6px;font-size:12px;cursor:pointer;font-weight:600">Book Demo</button></div></nav>`
        },
        {
            id: "navbar-alt",
            name: "Minimal Navbar",
            role: "navbar",
            status: "inactive",
            updatedAt: "2026-03-05",
            menuItems: [
                { id: "m1", label: "Home", href: "/" },
                { id: "m2", label: "About", href: "/about" }
            ],
            actions: [
                { id: "a1", label: "Get Started", type: "link_url", target: "/signup" }
            ],
            previewHtml: `<nav style="display:flex;justify-content:space-between;align-items:center;padding:12px 24px;background:#111827;color:#e2e8f0;font-family:system-ui"><span style="font-size:14px;font-weight:700">LMNAs</span><div style="display:flex;gap:16px;align-items:center"><a href="#" style="color:#64748b;text-decoration:none;font-size:13px">Home</a><a href="#" style="color:#64748b;text-decoration:none;font-size:13px">About</a><button style="background:#22c55e;border:none;color:white;padding:5px 12px;border-radius:6px;font-size:11px;cursor:pointer;font-weight:600">Get Started</button></div></nav>`
        },
        {
            id: "footer-main",
            name: "Main Footer",
            role: "footer",
            status: "active",
            updatedAt: "2026-03-09",
            menuItems: [
                { id: "f1", label: "Home", href: "/" },
                { id: "f2", label: "Terms", href: "/terms" },
                { id: "f3", label: "Privacy", href: "/privacy" }
            ],
            actions: [],
            previewHtml: `<footer style="padding:20px 28px;background:#0b1120;color:#64748b;font-family:system-ui;text-align:center;font-size:12px;border-top:1px solid #1e293b"><div style="display:flex;justify-content:center;gap:16px;margin-bottom:8px"><a href="#" style="color:#475569;text-decoration:none">Home</a><a href="#" style="color:#475569;text-decoration:none">Terms</a><a href="#" style="color:#475569;text-decoration:none">Privacy</a></div>&copy; 2026 LMNAs Platform</footer>`
        }
    ];
    localStorage.setItem("lmnas-shells", JSON.stringify(seed));
    return seed;
}

function saveShells(shells: ShellVariant[]) {
    if (typeof window !== "undefined") localStorage.setItem("lmnas-shells", JSON.stringify(shells));
}

/* ─── Component ─── */

export default function ShellWorkflowPage() {
    const [shells, setShells] = useState<ShellVariant[]>([]);
    const [selectedId, setSelectedId] = useState<string | null>(null);
    const [detailTab, setDetailTab] = useState<"preview" | "menu" | "actions">("preview");
    const [editingAction, setEditingAction] = useState<string | null>(null);

    useEffect(() => {
        const loaded = loadShells();
        setShells(loaded);
        if (loaded.length > 0) setSelectedId(loaded[0].id);
    }, []);

    const selected = shells.find((s) => s.id === selectedId) ?? null;
    const navbars = shells.filter((s) => s.role === "navbar");
    const footers = shells.filter((s) => s.role === "footer");

    function updateShell(id: string, patch: Partial<ShellVariant>) {
        const updated = shells.map((s) => s.id === id ? { ...s, ...patch } : s);
        setShells(updated);
        saveShells(updated);
    }

    function activateShell(id: string) {
        const role = shells.find((s) => s.id === id)?.role;
        const updated = shells.map((s) => ({
            ...s,
            status: (s.id === id ? "active" : s.role === role && s.status === "active" ? "inactive" : s.status) as ShellVariant["status"]
        }));
        setShells(updated);
        saveShells(updated);
    }

    function updateAction(shellId: string, actionId: string, patch: Partial<ShellAction>) {
        const shell = shells.find((s) => s.id === shellId);
        if (!shell) return;
        const updatedActions = shell.actions.map((a) => a.id === actionId ? { ...a, ...patch } : a);
        updateShell(shellId, { actions: updatedActions });
    }

    const input = "w-full rounded-lg border border-white/[0.06] bg-white/[0.03] px-3 py-2 text-sm text-slate-200 placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-blue-500/40";

    const statusBadge = (status: string) =>
        status === "active"
            ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/25"
            : "bg-slate-500/10 text-slate-500 border-slate-500/15";

    return (
        <div className="max-w-[1400px] mx-auto flex flex-col gap-5">
            <header>
                <h1 className="text-xl font-bold text-slate-100 flex items-center gap-2.5">
                    <span className="material-symbols-outlined text-2xl text-emerald-400">web</span>
                    Shell Management
                </h1>
                <p className="text-xs text-slate-500 mt-0.5">
                    Manage navbar and footer variants. One of each type can be active at a time. Active shells apply to all new pages.
                </p>
            </header>

            <div className="grid gap-5" style={{ gridTemplateColumns: selected ? "300px 1fr" : "1fr" }}>
                {/* Shell list */}
                <div className="flex flex-col gap-4 overflow-y-auto" style={{ maxHeight: "calc(100vh - 180px)" }}>
                    {/* Navbars */}
                    <div>
                        <p className="text-[10px] font-bold text-slate-600 uppercase tracking-widest mb-2 flex items-center gap-1.5">
                            <span className="material-symbols-outlined text-sm text-blue-400">menu</span>
                            Navbars
                        </p>
                        {navbars.map((shell) => (
                            <button
                                key={shell.id}
                                type="button"
                                onClick={() => { setSelectedId(shell.id); setDetailTab("preview"); }}
                                className={`w-full text-left rounded-xl p-3 mb-1.5 transition-all cursor-pointer ${selectedId === shell.id
                                        ? "bg-blue-500/[0.08] border border-blue-500/20"
                                        : "bg-white/[0.02] border border-white/[0.04] hover:border-white/[0.1]"
                                    }`}
                            >
                                <div className="flex items-center justify-between mb-1">
                                    <h3 className="text-sm font-semibold text-slate-200 truncate">{shell.name}</h3>
                                    <span className={`text-[9px] font-bold uppercase px-1.5 py-0.5 rounded-full border ${statusBadge(shell.status)}`}>
                                        {shell.status}
                                    </span>
                                </div>
                                <div className="flex items-center gap-2 text-[10px] text-slate-600">
                                    <span>{shell.menuItems.length} items</span>
                                    <span>·</span>
                                    <span>{shell.actions.length} CTAs</span>
                                    <span>·</span>
                                    <span>{shell.updatedAt}</span>
                                </div>
                            </button>
                        ))}
                    </div>

                    {/* Footers */}
                    <div>
                        <p className="text-[10px] font-bold text-slate-600 uppercase tracking-widest mb-2 flex items-center gap-1.5">
                            <span className="material-symbols-outlined text-sm text-blue-400">bottom_app_bar</span>
                            Footers
                        </p>
                        {footers.map((shell) => (
                            <button
                                key={shell.id}
                                type="button"
                                onClick={() => { setSelectedId(shell.id); setDetailTab("preview"); }}
                                className={`w-full text-left rounded-xl p-3 mb-1.5 transition-all cursor-pointer ${selectedId === shell.id
                                        ? "bg-blue-500/[0.08] border border-blue-500/20"
                                        : "bg-white/[0.02] border border-white/[0.04] hover:border-white/[0.1]"
                                    }`}
                            >
                                <div className="flex items-center justify-between mb-1">
                                    <h3 className="text-sm font-semibold text-slate-200 truncate">{shell.name}</h3>
                                    <span className={`text-[9px] font-bold uppercase px-1.5 py-0.5 rounded-full border ${statusBadge(shell.status)}`}>
                                        {shell.status}
                                    </span>
                                </div>
                                <div className="flex items-center gap-2 text-[10px] text-slate-600">
                                    <span>{shell.menuItems.length} links</span>
                                    <span>·</span>
                                    <span>{shell.updatedAt}</span>
                                </div>
                            </button>
                        ))}
                    </div>
                </div>

                {/* Detail Panel */}
                {selected ? (
                    <div className="rounded-xl bg-white/[0.02] border border-white/[0.06] overflow-hidden flex flex-col">
                        {/* Detail header */}
                        <header className="flex items-center justify-between border-b border-white/[0.06] px-5 py-3">
                            <div className="flex items-center gap-3">
                                <div>
                                    <h2 className="text-base font-bold text-slate-100">{selected.name}</h2>
                                    <p className="text-[10px] text-slate-500">{selected.role} · {selected.id}</p>
                                </div>
                                <span className={`text-[9px] font-bold uppercase px-2 py-0.5 rounded-full border ${statusBadge(selected.status)}`}>
                                    {selected.status}
                                </span>
                            </div>
                            <div className="flex gap-2">
                                {selected.status !== "active" ? (
                                    <button type="button" onClick={() => activateShell(selected.id)} className="px-3 py-1.5 rounded-lg bg-emerald-500/15 border border-emerald-500/25 text-emerald-400 text-xs font-bold hover:bg-emerald-500/25 cursor-pointer">
                                        Activate
                                    </button>
                                ) : (
                                    <button type="button" onClick={() => updateShell(selected.id, { status: "inactive" })} className="px-3 py-1.5 rounded-lg bg-white/[0.04] border border-white/[0.06] text-slate-400 text-xs font-semibold hover:bg-white/[0.08] cursor-pointer">
                                        Deactivate
                                    </button>
                                )}
                            </div>
                        </header>

                        {/* Tabs */}
                        <div className="flex border-b border-white/[0.06] px-5 gap-0.5">
                            {([
                                { key: "preview", label: "Preview", icon: "visibility" },
                                { key: "menu", label: "Menu Structure", icon: "list" },
                                { key: "actions", label: "Actions & CTAs", icon: "touch_app" }
                            ] as const).map((tab) => (
                                <button
                                    key={tab.key}
                                    type="button"
                                    onClick={() => setDetailTab(tab.key)}
                                    className={`flex items-center gap-1.5 px-3 py-2.5 text-xs font-semibold transition-colors cursor-pointer border-b-2 -mb-px ${detailTab === tab.key
                                            ? "text-blue-400 border-blue-400"
                                            : "text-slate-500 border-transparent hover:text-slate-300"
                                        }`}
                                >
                                    <span className="material-symbols-outlined text-sm">{tab.icon}</span>
                                    {tab.label}
                                </button>
                            ))}
                        </div>

                        <div className="p-5 flex-1 overflow-y-auto" style={{ maxHeight: "calc(100vh - 300px)" }}>
                            {/* Preview tab */}
                            {detailTab === "preview" && (
                                <div className="flex flex-col gap-4">
                                    <iframe
                                        className="w-full rounded-lg border border-white/[0.06] bg-white"
                                        style={{ minHeight: "200px", height: selected.role === "navbar" ? "80px" : "120px" }}
                                        srcDoc={selected.previewHtml}
                                        sandbox="allow-scripts allow-same-origin"
                                        title={selected.name}
                                    />
                                    <div className="grid grid-cols-3 gap-3">
                                        <div className="rounded-lg bg-white/[0.03] border border-white/[0.05] p-3 text-center">
                                            <p className="text-lg font-bold text-slate-200">{selected.menuItems.length}</p>
                                            <p className="text-[10px] text-slate-500">Menu Items</p>
                                        </div>
                                        <div className="rounded-lg bg-white/[0.03] border border-white/[0.05] p-3 text-center">
                                            <p className="text-lg font-bold text-slate-200">{selected.actions.length}</p>
                                            <p className="text-[10px] text-slate-500">CTAs</p>
                                        </div>
                                        <div className="rounded-lg bg-white/[0.03] border border-white/[0.05] p-3 text-center">
                                            <p className="text-lg font-bold text-slate-200">{selected.menuItems.reduce((s, m) => s + (m.children?.length ?? 0), 0)}</p>
                                            <p className="text-[10px] text-slate-500">Submenus</p>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Menu Structure tab */}
                            {detailTab === "menu" && (
                                <div className="flex flex-col gap-3">
                                    <p className="text-[10px] text-slate-500 uppercase tracking-wider">Navigation Items</p>
                                    {selected.menuItems.map((item) => (
                                        <div key={item.id} className="rounded-lg bg-white/[0.02] border border-white/[0.05] overflow-hidden">
                                            <div className="flex items-center gap-3 px-3.5 py-2.5">
                                                <span className="material-symbols-outlined text-sm text-blue-400">link</span>
                                                <div className="flex-1">
                                                    <p className="text-sm font-medium text-slate-200">{item.label}</p>
                                                    <p className="text-[10px] font-mono text-slate-600">{item.href}</p>
                                                </div>
                                                {item.children && item.children.length > 0 && (
                                                    <span className="text-[10px] text-slate-600 bg-white/[0.04] px-1.5 py-0.5 rounded">{item.children.length} sub</span>
                                                )}
                                            </div>
                                            {item.children && item.children.length > 0 && (
                                                <div className="border-t border-white/[0.04] bg-white/[0.01] px-3.5 py-2 flex flex-col gap-1.5">
                                                    {item.children.map((ch) => (
                                                        <div key={ch.id} className="flex items-center gap-2 pl-5">
                                                            <span className="w-1 h-1 rounded-full bg-slate-600" />
                                                            <span className="text-xs text-slate-400">{ch.label}</span>
                                                            <span className="text-[10px] font-mono text-slate-600">{ch.href}</span>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                    {selected.menuItems.length === 0 && (
                                        <p className="text-xs text-slate-600 py-4 text-center">No menu items configured.</p>
                                    )}
                                </div>
                            )}

                            {/* Actions tab */}
                            {detailTab === "actions" && (
                                <div className="flex flex-col gap-3">
                                    <div className="flex items-center justify-between mb-1">
                                        <p className="text-[10px] text-slate-500 uppercase tracking-wider">CTAs &amp; Actions</p>
                                        <button
                                            type="button"
                                            onClick={() => {
                                                const newAction: ShellAction = { id: `sa-${Date.now()}`, label: "New Action", type: "link_url", target: "/" };
                                                updateShell(selected.id, { actions: [...selected.actions, newAction] });
                                            }}
                                            className="text-[10px] font-semibold text-blue-400 hover:text-blue-300 cursor-pointer flex items-center gap-1"
                                        >
                                            <span className="material-symbols-outlined text-sm">add</span>
                                            Add
                                        </button>
                                    </div>

                                    {selected.actions.map((action) => (
                                        <div key={action.id} className="rounded-lg bg-white/[0.02] border border-white/[0.05] p-3.5">
                                            {editingAction === action.id ? (
                                                <div className="flex flex-col gap-2.5">
                                                    <label className="flex flex-col gap-1">
                                                        <span className="text-[10px] text-slate-500 uppercase">Label</span>
                                                        <input className={input} value={action.label} onChange={(e) => updateAction(selected.id, action.id, { label: e.target.value })} />
                                                    </label>
                                                    <label className="flex flex-col gap-1">
                                                        <span className="text-[10px] text-slate-500 uppercase">Type</span>
                                                        <select className={input} value={action.type} onChange={(e) => updateAction(selected.id, action.id, { type: e.target.value as ShellAction["type"] })}>
                                                            {ACTION_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                                                        </select>
                                                    </label>
                                                    <label className="flex flex-col gap-1">
                                                        <span className="text-[10px] text-slate-500 uppercase">Target</span>
                                                        <input className={input} value={action.target} onChange={(e) => updateAction(selected.id, action.id, { target: e.target.value })} />
                                                    </label>
                                                    <button type="button" onClick={() => setEditingAction(null)} className="self-end px-3 py-1 rounded-lg bg-blue-500/15 text-blue-400 text-xs font-semibold cursor-pointer">Done</button>
                                                </div>
                                            ) : (
                                                <div className="flex items-center justify-between">
                                                    <div className="flex items-center gap-3">
                                                        <span className="material-symbols-outlined text-sm text-amber-400">touch_app</span>
                                                        <div>
                                                            <p className="text-sm font-medium text-slate-200">{action.label}</p>
                                                            <p className="text-[10px] text-slate-600">{ACTION_TYPES.find((t) => t.value === action.type)?.label ?? action.type} → {action.target}</p>
                                                        </div>
                                                    </div>
                                                    <button type="button" onClick={() => setEditingAction(action.id)} className="text-[10px] text-blue-400 hover:text-blue-300 cursor-pointer font-semibold">
                                                        Edit
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                    ))}

                                    {selected.actions.length === 0 && (
                                        <p className="text-xs text-slate-600 py-4 text-center">No actions configured.</p>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                ) : (
                    <div className="rounded-xl bg-white/[0.01] border border-dashed border-white/[0.06] flex flex-col items-center justify-center min-h-[400px]">
                        <span className="material-symbols-outlined text-4xl text-slate-700 mb-2">web</span>
                        <p className="text-sm text-slate-500">Select a shell to inspect</p>
                    </div>
                )}
            </div>
        </div>
    );
}
