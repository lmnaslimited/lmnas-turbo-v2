"use client";

import React from "react";

interface FidelityDisplayProps {
    score: number;
    arbitraryValueCount: number;
    hasDarkMode: boolean;
    extractedFonts: string[];
    themeDebtSummary: string;
}

export function FidelityDisplay({
    score,
    arbitraryValueCount,
    hasDarkMode,
    extractedFonts,
    themeDebtSummary
}: FidelityDisplayProps) {
    const scorePercent = Math.round(score * 100);
    const scoreColor =
        scorePercent >= 80 ? "text-emerald-400" : scorePercent >= 50 ? "text-amber-400" : "text-red-400";
    const scoreLabel =
        scorePercent >= 80 ? "Excellent" : scorePercent >= 50 ? "Acceptable" : "Needs Review";

    return (
        <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
            <h3 className="text-xs font-semibold text-slate-300 mb-3 flex items-center gap-1.5">
                <span className="material-symbols-outlined text-sm text-blue-400">verified</span>
                Fidelity &amp; Theme
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {/* Score */}
                <div className="rounded-lg bg-white/[0.03] border border-white/[0.05] p-3 text-center">
                    <p className={`text-2xl font-bold ${scoreColor}`}>{scorePercent}%</p>
                    <p className="text-[10px] text-slate-500 uppercase tracking-wider">Fidelity</p>
                    <p className="text-[10px] text-slate-600">{scoreLabel}</p>
                </div>

                {/* Metrics */}
                <div className="rounded-lg bg-white/[0.03] border border-white/[0.05] p-3 flex flex-col justify-center gap-1.5">
                    <div className="flex justify-between text-[11px]">
                        <span className="text-slate-400">Arbitrary Values</span>
                        <span className="font-mono text-amber-400 font-semibold">{arbitraryValueCount}</span>
                    </div>
                    <div className="flex justify-between text-[11px]">
                        <span className="text-slate-400">Dark Mode</span>
                        <span className={`font-semibold ${hasDarkMode ? "text-emerald-400" : "text-slate-600"}`}>
                            {hasDarkMode ? "Yes" : "No"}
                        </span>
                    </div>
                    <div className="flex justify-between text-[11px]">
                        <span className="text-slate-400">Fonts</span>
                        <span className="font-mono text-violet-400 font-semibold">{extractedFonts.length}</span>
                    </div>
                </div>

                {/* Debt */}
                <div className="rounded-lg bg-amber-500/[0.06] border border-amber-500/15 p-3">
                    <p className="text-[11px] text-amber-400/80 leading-relaxed">
                        <strong className="text-amber-400">Debt:</strong> {themeDebtSummary}
                    </p>
                </div>
            </div>
        </div>
    );
}
