"use client";

import React, { useEffect, useState } from "react";

/* ─── Types ─── */

interface PageBlock {
    id: string;
    name: string;
    family: string;
    group: string;
    previewHtml: string;
    editableFields: Array<{ key: string; label: string; type: string; value: string }>;
    actions: Array<{ id: string; label: string; type: string; target: string }>;
}

interface PageAction {
    id: string;
    blockId: string;
    label: string;
    type: string;
    target: string;
}

const BLOCK_GROUPS: Record<string, string> = {
    hero: "Headers & Heroes",
    content: "Content",
    conversion: "Conversion",
    social_proof: "Social Proof"
};

const ACTION_TYPES = [
    { value: "link_url", label: "Navigate to URL" },
    { value: "scroll_to_section", label: "Scroll to section" },
    { value: "open_modal", label: "Open modal" },
    { value: "open_drawer", label: "Open drawer" },
    { value: "open_widget", label: "Open widget" },
    { value: "submit_form", label: "Submit form" },
    { value: "download_asset", label: "Download asset" },
    { value: "external_booking", label: "Open external booking" },
    { value: "workflow", label: "Trigger backend workflow" }
];

/* ─── Seed blocks ─── */

const AVAILABLE_BLOCKS: PageBlock[] = [
    {
        id: "blk-hero-1",
        name: "Hero Section",
        family: "hero",
        group: "hero",
        previewHtml: `<section style="padding:56px 32px;background:linear-gradient(135deg,#0f172a 0%,#1e293b 100%);color:#f8fafc;font-family:system-ui"><h1 style="font-size:32px;font-weight:800;letter-spacing:-0.8px;margin:0">Build faster with LMNAs</h1><p style="color:#94a3b8;margin-top:10px;font-size:14px;max-width:480px;line-height:1.5">Launch governed pages in minutes. Ship beautiful landing pages backed by a real CMS.</p><div style="margin-top:20px;display:flex;gap:10px"><button style="background:#3b82f6;border:none;color:white;padding:10px 20px;border-radius:8px;font-size:13px;font-weight:600;cursor:pointer">Get Started</button><button style="background:transparent;border:1px solid #334155;color:#94a3b8;padding:10px 20px;border-radius:8px;font-size:13px;cursor:pointer">Learn More</button></div></section>`,
        editableFields: [
            { key: "heading", label: "Heading", type: "text", value: "Build faster with LMNAs" },
            { key: "subheading", label: "Subheading", type: "text", value: "Launch governed pages in minutes." },
            { key: "cta_primary", label: "Primary CTA", type: "text", value: "Get Started" },
            { key: "cta_secondary", label: "Secondary CTA", type: "text", value: "Learn More" }
        ],
        actions: [
            { id: "a1", label: "Get Started", type: "link_url", target: "/signup" },
            { id: "a2", label: "Learn More", type: "scroll_to_section", target: "#features" }
        ]
    },
    {
        id: "blk-features-1",
        name: "Feature Grid",
        family: "feature_grid",
        group: "content",
        previewHtml: `<section style="padding:40px 32px;background:#0f172a;font-family:system-ui"><h2 style="color:#f1f5f9;font-size:22px;font-weight:700;margin:0 0 20px">Platform Features</h2><div style="display:grid;grid-template-columns:repeat(3,1fr);gap:12px">${[
            { title: "Visual Editor", desc: "Drag-and-drop page assembly" },
            { title: "Theme Engine", desc: "Token-first design system" },
            { title: "CMS Sync", desc: "Auto-publish to Strapi" }
        ].map(f => `<div style="background:#1e293b;border:1px solid #334155;border-radius:10px;padding:20px"><h3 style="color:#e2e8f0;font-size:14px;font-weight:600;margin:0">${f.title}</h3><p style="color:#64748b;font-size:12px;margin-top:4px">${f.desc}</p></div>`).join("")}</div></section>`,
        editableFields: [
            { key: "section_title", label: "Section Title", type: "text", value: "Platform Features" }
        ],
        actions: []
    },
    {
        id: "blk-testimonials-1",
        name: "Testimonials",
        family: "testimonial_list",
        group: "social_proof",
        previewHtml: `<section style="padding:40px 32px;background:#111827;font-family:system-ui"><h2 style="color:#f1f5f9;font-size:22px;font-weight:700;margin:0 0 16px">What People Say</h2><div style="display:flex;gap:12px"><div style="flex:1;background:#1e293b;border:1px solid #334155;border-radius:10px;padding:16px"><p style="color:#94a3b8;font-size:12px;font-style:italic">"LMNAs simplified our entire web workflow."</p><p style="color:#e2e8f0;font-size:12px;margin-top:8px;font-weight:600">— Sarah Chen</p></div><div style="flex:1;background:#1e293b;border:1px solid #334155;border-radius:10px;padding:16px"><p style="color:#94a3b8;font-size:12px;font-style:italic">"The best platform for governed publishing."</p><p style="color:#e2e8f0;font-size:12px;margin-top:8px;font-weight:600">— James Park</p></div></div></section>`,
        editableFields: [],
        actions: []
    },
    {
        id: "blk-cta-1",
        name: "CTA Banner",
        family: "cta_banner",
        group: "conversion",
        previewHtml: `<section style="padding:40px 32px;background:linear-gradient(135deg,#3b82f6,#1d4ed8);color:#fff;text-align:center;font-family:system-ui"><h2 style="font-size:24px;font-weight:700;margin:0">Ready to transform your web presence?</h2><p style="margin-top:8px;font-size:14px;opacity:0.85">Start your free trial today.</p><button style="margin-top:16px;background:#fff;color:#1d4ed8;border:none;padding:10px 24px;border-radius:8px;font-weight:600;font-size:13px;cursor:pointer">Book Appointment</button></section>`,
        editableFields: [
            { key: "heading", label: "Heading", type: "text", value: "Ready to transform your web presence?" },
            { key: "subheading", label: "Subheading", type: "text", value: "Start your free trial today." },
            { key: "cta_text", label: "CTA Text", type: "text", value: "Book Appointment" }
        ],
        actions: [
            { id: "ca1", label: "Book Appointment", type: "external_booking", target: "https://calendly.com/example" }
        ]
    },
    {
        id: "blk-faq-1",
        name: "FAQ Section",
        family: "faq",
        group: "content",
        previewHtml: `<section style="padding:40px 32px;background:#0f172a;font-family:system-ui"><h2 style="color:#f1f5f9;font-size:22px;font-weight:700;margin:0 0 16px">Frequently Asked Questions</h2><div style="display:flex;flex-direction:column;gap:8px"><div style="background:#1e293b;border:1px solid #334155;border-radius:8px;padding:14px"><p style="color:#e2e8f0;font-size:13px;font-weight:600;margin:0">How does LMNAs work?</p><p style="color:#64748b;font-size:12px;margin-top:6px">LMNAs provides a visual editor backed by a headless CMS.</p></div><div style="background:#1e293b;border:1px solid #334155;border-radius:8px;padding:14px"><p style="color:#e2e8f0;font-size:13px;font-weight:600;margin:0">Is it self-hosted?</p><p style="color:#64748b;font-size:12px;margin-top:6px">Yes, LMNAs can be deployed on your own infrastructure.</p></div></div></section>`,
        editableFields: [],
        actions: []
    }
];

/* ─── Shells ─── */

const SHELL_NAVBAR = `<nav style="display:flex;justify-content:space-between;align-items:center;padding:14px 28px;background:#0f172a;color:#f8fafc;font-family:system-ui;border-bottom:1px solid #1e293b"><strong style="font-size:16px;letter-spacing:-0.4px">LMNAs</strong><div style="display:flex;gap:20px"><a href="#" style="color:#94a3b8;text-decoration:none;font-size:13px">Products</a><a href="#" style="color:#94a3b8;text-decoration:none;font-size:13px">Solutions</a><a href="#" style="color:#94a3b8;text-decoration:none;font-size:13px">Pricing</a></div><button style="background:#3b82f6;border:none;color:white;padding:6px 14px;border-radius:6px;font-size:12px;cursor:pointer;font-weight:600">Book Demo</button></nav>`;

const SHELL_FOOTER = `<footer style="padding:20px 28px;background:#0b1120;color:#64748b;font-family:system-ui;text-align:center;font-size:12px;border-top:1px solid #1e293b">&copy; 2026 LMNAs Platform</footer>`;

/* ─── Component ─── */

export default function PageWorkflowPage() {
    const [pageBlocks, setPageBlocks] = useState<string[]>([]);
    const [pageName, setPageName] = useState("New Page");
    const [pageSlug, setPageSlug] = useState("new-page");
    const [selectedBlockId, setSelectedBlockId] = useState<string | null>(null);
    const [drawerOpen, setDrawerOpen] = useState(false);
    const [inspectorTab, setInspectorTab] = useState<"content" | "actions">("content");
    const [fieldValues, setFieldValues] = useState<Record<string, string>>({});
    const [actionOverrides, setActionOverrides] = useState<Record<string, PageAction>>({});
    const [showShell, setShowShell] = useState(true);
    const [hasLoadedStorage, setHasLoadedStorage] = useState(false);

    useEffect(() => {
        if (typeof window !== "undefined") setHasLoadedStorage(true);
    }, []);

    const selectedBlock = AVAILABLE_BLOCKS.find((b) => b.id === selectedBlockId) ?? null;

    function addBlock(blockId: string) {
        setPageBlocks((prev) => [...prev, blockId]);
        setDrawerOpen(false);
    }

    function removeBlock(index: number) {
        const blockId = pageBlocks[index];
        setPageBlocks((prev) => prev.filter((_, i) => i !== index));
        if (selectedBlockId === blockId) setSelectedBlockId(null);
    }

    function moveBlock(index: number, dir: -1 | 1) {
        const arr = [...pageBlocks];
        const swap = index + dir;
        if (swap < 0 || swap >= arr.length) return;
        [arr[index], arr[swap]] = [arr[swap], arr[index]];
        setPageBlocks(arr);
    }

    // Build full page preview HTML
    const pagePreviewHtml = (() => {
        const body = pageBlocks.map((bid) => {
            const block = AVAILABLE_BLOCKS.find((b) => b.id === bid);
            return block?.previewHtml ?? "";
        }).join("\n");
        return `<!DOCTYPE html><html><head><meta charset="utf-8"><style>*{margin:0;padding:0;box-sizing:border-box}</style></head><body style="background:#0b1120">${showShell ? SHELL_NAVBAR : ""}${body}${showShell ? SHELL_FOOTER : ""}</body></html>`;
    })();

    // Group available blocks
    const groupedBlocks = Object.entries(BLOCK_GROUPS).map(([key, label]) => ({
        key,
        label,
        blocks: AVAILABLE_BLOCKS.filter((b) => b.group === key)
    })).filter((g) => g.blocks.length > 0);

    const input = "w-full rounded-lg border border-white/[0.06] bg-white/[0.03] px-3 py-2 text-sm text-slate-200 placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-blue-500/40";

    return (
        <div className="max-w-[1600px] mx-auto flex flex-col gap-4">
            {/* Header */}
            <header className="flex items-center justify-between">
                <div>
                    <h1 className="text-xl font-bold text-slate-100 flex items-center gap-2.5">
                        <span className="material-symbols-outlined text-2xl text-amber-400">article</span>
                        Page Editor
                    </h1>
                    <p className="text-xs text-slate-500 mt-0.5">Assemble pages from blocks. Active shell applied automatically.</p>
                </div>
                <div className="flex items-center gap-2">
                    <button
                        type="button"
                        onClick={() => setDrawerOpen((v) => !v)}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${drawerOpen ? "bg-violet-500/15 text-violet-400 border border-violet-500/25" : "bg-white/[0.04] text-slate-400 border border-white/[0.06] hover:bg-white/[0.08]"
                            }`}
                    >
                        <span className="material-symbols-outlined text-sm">dashboard_customize</span>
                        {drawerOpen ? "Close Library" : "Add Block"}
                    </button>
                    <button
                        type="button"
                        onClick={() => setShowShell((v) => !v)}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${showShell ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/25" : "bg-white/[0.04] text-slate-400 border border-white/[0.06]"
                            }`}
                    >
                        <span className="material-symbols-outlined text-sm">web</span>
                        Shell {showShell ? "On" : "Off"}
                    </button>
                    <button
                        type="button"
                        className="px-4 py-1.5 rounded-lg bg-emerald-500 text-white text-xs font-bold shadow-lg shadow-emerald-500/20 hover:brightness-110 cursor-pointer"
                    >
                        Sync to Strapi
                    </button>
                </div>
            </header>

            {/* Page settings bar */}
            <div className="flex items-center gap-4 rounded-lg bg-white/[0.02] border border-white/[0.04] px-4 py-2.5">
                <label className="flex items-center gap-2 flex-1">
                    <span className="text-[10px] text-slate-500 uppercase tracking-wider whitespace-nowrap">Name</span>
                    <input className={`${input} py-1.5`} value={pageName} onChange={(e) => setPageName(e.target.value)} />
                </label>
                <label className="flex items-center gap-2 flex-1">
                    <span className="text-[10px] text-slate-500 uppercase tracking-wider whitespace-nowrap">Slug</span>
                    <input className={`${input} py-1.5`} value={pageSlug} onChange={(e) => setPageSlug(e.target.value)} />
                </label>
            </div>

            {/* Main workspace */}
            <div className="flex gap-4" style={{ minHeight: "calc(100vh - 200px)" }}>
                {/* Block Library Drawer (overlay, not permanently eating space) */}
                {drawerOpen && (
                    <div className="w-[280px] flex-shrink-0 rounded-xl bg-white/[0.02] border border-white/[0.06] p-4 overflow-y-auto" style={{ maxHeight: "calc(100vh - 200px)" }}>
                        <h2 className="text-xs font-bold text-slate-300 mb-3">Block Library</h2>
                        {groupedBlocks.map((group) => (
                            <div key={group.key} className="mb-4">
                                <p className="text-[10px] font-bold text-slate-600 uppercase tracking-widest mb-2">{group.label}</p>
                                {group.blocks.map((block) => (
                                    <button
                                        key={block.id}
                                        type="button"
                                        onClick={() => addBlock(block.id)}
                                        className="w-full flex items-center gap-2.5 rounded-lg p-2.5 mb-1 text-left bg-white/[0.02] border border-white/[0.04] hover:border-white/[0.12] transition-all cursor-pointer"
                                    >
                                        <div className="flex-1 min-w-0">
                                            <p className="text-xs font-medium text-slate-300">{block.name}</p>
                                            <p className="text-[10px] text-slate-600">{block.family.replaceAll("_", " ")}</p>
                                        </div>
                                        <span className="material-symbols-outlined text-sm text-slate-500">add</span>
                                    </button>
                                ))}
                            </div>
                        ))}
                    </div>
                )}

                {/* Page Preview (full width when drawer closed) */}
                <div className="flex-1 rounded-xl bg-white/[0.02] border border-white/[0.06] overflow-hidden flex flex-col">
                    <div className="flex items-center justify-between border-b border-white/[0.06] px-4 py-2">
                        <p className="text-xs font-semibold text-slate-400">Live Preview</p>
                        <span className="text-[10px] text-slate-600">{pageBlocks.length} blocks</span>
                    </div>
                    {pageBlocks.length === 0 ? (
                        <div className="flex-1 flex flex-col items-center justify-center p-12">
                            <span className="material-symbols-outlined text-5xl text-slate-700 mb-3">add_circle_outline</span>
                            <p className="text-sm text-slate-500">Open the Block Library to start assembling.</p>
                        </div>
                    ) : (
                        <iframe
                            className="w-full flex-1 border-none bg-white"
                            style={{ minHeight: "600px" }}
                            srcDoc={pagePreviewHtml}
                            sandbox="allow-scripts allow-same-origin"
                            title="Page preview"
                        />
                    )}
                </div>

                {/* Block Inspector (appears when a block is selected) */}
                {selectedBlock && (
                    <div className="w-[320px] flex-shrink-0 rounded-xl bg-white/[0.02] border border-white/[0.06] overflow-hidden flex flex-col" style={{ maxHeight: "calc(100vh - 200px)" }}>
                        <header className="flex items-center justify-between border-b border-white/[0.06] px-4 py-3">
                            <div>
                                <h3 className="text-sm font-bold text-slate-200">{selectedBlock.name}</h3>
                                <p className="text-[10px] text-slate-600">{selectedBlock.family.replaceAll("_", " ")}</p>
                            </div>
                            <button type="button" onClick={() => setSelectedBlockId(null)} className="text-slate-500 hover:text-slate-300 cursor-pointer">
                                <span className="material-symbols-outlined text-sm">close</span>
                            </button>
                        </header>

                        <div className="flex border-b border-white/[0.06] px-4 gap-0.5">
                            {([
                                { key: "content", label: "Content", icon: "edit" },
                                { key: "actions", label: "Actions", icon: "touch_app" }
                            ] as const).map((tab) => (
                                <button
                                    key={tab.key}
                                    type="button"
                                    onClick={() => setInspectorTab(tab.key)}
                                    className={`flex items-center gap-1 px-2.5 py-2 text-[11px] font-semibold cursor-pointer border-b-2 -mb-px transition-colors ${inspectorTab === tab.key ? "text-blue-400 border-blue-400" : "text-slate-500 border-transparent"
                                        }`}
                                >
                                    <span className="material-symbols-outlined text-xs">{tab.icon}</span>
                                    {tab.label}
                                </button>
                            ))}
                        </div>

                        <div className="p-4 flex-1 overflow-y-auto flex flex-col gap-3">
                            {inspectorTab === "content" && (
                                <>
                                    {selectedBlock.editableFields.length === 0 && (
                                        <p className="text-xs text-slate-600 text-center py-4">No editable fields for this block.</p>
                                    )}
                                    {selectedBlock.editableFields.map((field) => (
                                        <label key={field.key} className="flex flex-col gap-1">
                                            <span className="text-[10px] text-slate-500 uppercase tracking-wider">{field.label}</span>
                                            {field.type === "text" ? (
                                                <input
                                                    className={input}
                                                    value={fieldValues[`${selectedBlock.id}.${field.key}`] ?? field.value}
                                                    onChange={(e) => setFieldValues((p) => ({ ...p, [`${selectedBlock.id}.${field.key}`]: e.target.value }))}
                                                />
                                            ) : (
                                                <textarea
                                                    className={`${input} min-h-[80px]`}
                                                    value={fieldValues[`${selectedBlock.id}.${field.key}`] ?? field.value}
                                                    onChange={(e) => setFieldValues((p) => ({ ...p, [`${selectedBlock.id}.${field.key}`]: e.target.value }))}
                                                />
                                            )}
                                        </label>
                                    ))}
                                </>
                            )}

                            {inspectorTab === "actions" && (
                                <>
                                    {selectedBlock.actions.length === 0 && (
                                        <p className="text-xs text-slate-600 text-center py-4">No actions on this block.</p>
                                    )}
                                    <p className="text-[10px] text-slate-500">Page-level overrides replace block defaults.</p>
                                    {selectedBlock.actions.map((action) => {
                                        const override = actionOverrides[`${selectedBlock.id}.${action.id}`];
                                        const currentType = override?.type ?? action.type;
                                        const currentTarget = override?.target ?? action.target;
                                        return (
                                            <div key={action.id} className="rounded-lg bg-white/[0.02] border border-white/[0.05] p-3 flex flex-col gap-2">
                                                <div className="flex items-center gap-2">
                                                    <span className="material-symbols-outlined text-sm text-amber-400">touch_app</span>
                                                    <span className="text-xs font-medium text-slate-200">{action.label}</span>
                                                </div>
                                                <label className="flex flex-col gap-1">
                                                    <span className="text-[10px] text-slate-500 uppercase">Type</span>
                                                    <select
                                                        className={input}
                                                        value={currentType}
                                                        onChange={(e) => setActionOverrides((p) => ({
                                                            ...p,
                                                            [`${selectedBlock.id}.${action.id}`]: {
                                                                id: action.id,
                                                                blockId: selectedBlock.id,
                                                                label: action.label,
                                                                type: e.target.value,
                                                                target: currentTarget
                                                            }
                                                        }))}
                                                    >
                                                        {ACTION_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                                                    </select>
                                                </label>
                                                <label className="flex flex-col gap-1">
                                                    <span className="text-[10px] text-slate-500 uppercase">Target</span>
                                                    <input
                                                        className={input}
                                                        value={currentTarget}
                                                        onChange={(e) => setActionOverrides((p) => ({
                                                            ...p,
                                                            [`${selectedBlock.id}.${action.id}`]: {
                                                                id: action.id,
                                                                blockId: selectedBlock.id,
                                                                label: action.label,
                                                                type: currentType,
                                                                target: e.target.value
                                                            }
                                                        }))}
                                                    />
                                                </label>
                                            </div>
                                        );
                                    })}
                                </>
                            )}
                        </div>
                    </div>
                )}
            </div>

            {/* Block Order Strip (below preview) */}
            {pageBlocks.length > 0 && (
                <div className="flex items-center gap-2 rounded-lg bg-white/[0.02] border border-white/[0.04] px-3 py-2 overflow-x-auto">
                    <span className="text-[10px] text-slate-600 uppercase tracking-wider whitespace-nowrap">Order:</span>
                    {pageBlocks.map((bid, index) => {
                        const block = AVAILABLE_BLOCKS.find((b) => b.id === bid);
                        if (!block) return null;
                        return (
                            <div key={`${bid}-${index}`} className="flex items-center gap-1 group">
                                <button
                                    type="button"
                                    onClick={() => { setSelectedBlockId(bid); setInspectorTab("content"); }}
                                    className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs transition-all cursor-pointer ${selectedBlockId === bid
                                            ? "bg-blue-500/[0.1] border border-blue-500/20 text-blue-300"
                                            : "bg-white/[0.03] border border-white/[0.05] text-slate-400 hover:border-white/[0.1]"
                                        }`}
                                >
                                    <span className="text-[10px] font-bold text-slate-600">{index + 1}</span>
                                    <span className="font-medium">{block.name}</span>
                                </button>
                                <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <button type="button" onClick={() => moveBlock(index, -1)} disabled={index === 0} className="p-0.5 text-slate-600 hover:text-slate-300 disabled:opacity-30 cursor-pointer"><span className="material-symbols-outlined text-xs">arrow_back</span></button>
                                    <button type="button" onClick={() => moveBlock(index, 1)} disabled={index === pageBlocks.length - 1} className="p-0.5 text-slate-600 hover:text-slate-300 disabled:opacity-30 cursor-pointer"><span className="material-symbols-outlined text-xs">arrow_forward</span></button>
                                    <button type="button" onClick={() => removeBlock(index)} className="p-0.5 text-red-400/50 hover:text-red-400 cursor-pointer"><span className="material-symbols-outlined text-xs">close</span></button>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
