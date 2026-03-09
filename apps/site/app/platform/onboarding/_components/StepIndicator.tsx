"use client";

import React from "react";

interface StepIndicatorProps {
    steps: readonly string[];
    current: number;
    onStepClick?: (index: number) => void;
}

export function StepIndicator({ steps, current, onStepClick }: StepIndicatorProps) {
    return (
        <div className="flex items-center gap-1 overflow-x-auto pb-0.5">
            {steps.map((label, index) => {
                const isComplete = index < current;
                const isActive = index === current;
                const isFuture = index > current;

                return (
                    <React.Fragment key={label}>
                        {index > 0 && (
                            <div className={`h-[1px] flex-1 min-w-[12px] ${isComplete ? "bg-blue-500/40" : "bg-white/[0.06]"}`} />
                        )}
                        <button
                            type="button"
                            onClick={() => onStepClick?.(index)}
                            disabled={!onStepClick || isFuture}
                            className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium whitespace-nowrap transition-all cursor-pointer disabled:cursor-not-allowed ${isActive
                                    ? "bg-blue-500/[0.12] text-blue-300 border border-blue-500/25"
                                    : isComplete
                                        ? "bg-emerald-500/[0.08] text-emerald-400 border border-emerald-500/15"
                                        : "bg-white/[0.02] text-slate-600 border border-white/[0.04]"
                                }`}
                        >
                            <span className={`flex items-center justify-center w-4 h-4 rounded-full text-[9px] font-bold ${isActive ? "bg-blue-500 text-white" :
                                    isComplete ? "bg-emerald-500/20 text-emerald-400" :
                                        "bg-white/[0.06] text-slate-600"
                                }`}>
                                {isComplete ? "✓" : index + 1}
                            </span>
                            {label}
                        </button>
                    </React.Fragment>
                );
            })}
        </div>
    );
}
