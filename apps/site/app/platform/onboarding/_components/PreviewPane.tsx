"use client";

import React, { useRef } from "react";

const VIEWPORT_OPTIONS = [
    { key: "desktop", label: "Desktop", width: 1280 },
    { key: "tablet", label: "Tablet", width: 768 },
    { key: "mobile", label: "Mobile", width: 430 }
] as const;

interface PreviewPaneProps {
    title: string;
    srcDoc: string;
    viewport?: "desktop" | "tablet" | "mobile";
    zoom?: number;
    onViewportChange?: (viewport: "desktop" | "tablet" | "mobile") => void;
    onZoomChange?: (zoom: number) => void;
    minHeight?: string;
    testId?: string;
    badge?: string;
}

export function PreviewPane({
    title,
    srcDoc,
    viewport = "desktop",
    zoom = 100,
    onViewportChange,
    onZoomChange,
    minHeight = "500px",
    testId,
    badge
}: PreviewPaneProps) {
    const activeWidth = VIEWPORT_OPTIONS.find((o) => o.key === viewport)?.width ?? 1280;
    const iframeRef = useRef<HTMLIFrameElement | null>(null);

    return (
        <article className="rounded-xl border border-white/[0.06] bg-white/[0.01] overflow-hidden flex flex-col">
            <header className="flex items-center justify-between border-b border-white/[0.06] px-4 py-2.5">
                <div className="flex items-center gap-2">
                    <h3 className="text-xs font-semibold text-slate-300">{title}</h3>
                    {badge && (
                        <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/15">
                            {badge}
                        </span>
                    )}
                </div>
                <div className="flex items-center gap-2">
                    {onViewportChange && (
                        <div className="flex rounded-lg border border-white/[0.06] overflow-hidden">
                            {VIEWPORT_OPTIONS.map((opt) => (
                                <button
                                    key={opt.key}
                                    type="button"
                                    onClick={() => onViewportChange(opt.key)}
                                    className={`px-2 py-1 text-[10px] font-medium transition-colors cursor-pointer ${viewport === opt.key ? "bg-blue-500/10 text-blue-400" : "text-slate-600 hover:text-slate-400"
                                        }`}
                                >
                                    {opt.label}
                                </button>
                            ))}
                        </div>
                    )}
                    {onZoomChange && (
                        <select
                            className="rounded-lg border border-white/[0.06] bg-white/[0.03] px-2 py-1 text-[10px] text-slate-400 font-mono"
                            value={zoom}
                            onChange={(e) => onZoomChange(Number(e.target.value))}
                        >
                            {[50, 75, 100, 125, 150].map((z) => <option key={z} value={z}>{z}%</option>)}
                        </select>
                    )}
                </div>
            </header>
            <div className="p-2 flex-1 flex justify-center overflow-auto bg-[#0b1120]">
                <iframe
                    ref={iframeRef}
                    className="rounded-lg border border-white/[0.06] bg-white transition-all"
                    style={{
                        width: `${activeWidth}px`,
                        minHeight,
                        height: minHeight,
                        transform: `scale(${zoom / 100})`,
                        transformOrigin: "top center"
                    }}
                    srcDoc={srcDoc}
                    sandbox="allow-scripts allow-same-origin"
                    title={title}
                    data-testid={testId}
                />
            </div>
        </article>
    );
}
