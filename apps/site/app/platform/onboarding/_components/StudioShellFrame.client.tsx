"use client";

import React, { useEffect, useMemo, useState } from "react";
import type { StudioBlockTemplate, StudioShell } from "../_lib/studio-types";

type StudioShellFrameProps = {
  children: React.ReactNode;
};

type ActiveShellMapping = {
  navbarBlockNames: string[];
  footerBlockNames: string[];
};

function resolveActiveShell(shells: StudioShell[]): StudioShell | null {
  return shells.find((shell) => shell.status === "active") ?? null;
}

export function StudioShellFrame({ children }: StudioShellFrameProps): React.ReactElement {
  const [shells, setShells] = useState<StudioShell[]>([]);
  const [blocks, setBlocks] = useState<StudioBlockTemplate[]>([]);

  useEffect(() => {
    let mounted = true;
    const refresh = async (): Promise<void> => {
      try {
        const [shellsResponse, blocksResponse] = await Promise.all([
          fetch("/api/platform/studio/shells", { method: "GET", headers: { "content-type": "application/json" } }),
          fetch("/api/platform/studio/blocks", { method: "GET", headers: { "content-type": "application/json" } })
        ]);

        const shellsPayload = (await shellsResponse.json()) as { ok: boolean; data?: StudioShell[] };
        const blocksPayload = (await blocksResponse.json()) as { ok: boolean; data?: StudioBlockTemplate[] };
        if (!mounted) {
          return;
        }

        if (shellsPayload.ok && Array.isArray(shellsPayload.data)) {
          setShells(shellsPayload.data);
        }
        if (blocksPayload.ok && Array.isArray(blocksPayload.data)) {
          setBlocks(blocksPayload.data);
        }
      } catch {
        if (mounted) {
          setShells([]);
          setBlocks([]);
        }
      }
    };

    void refresh();
    const handleShellUpdated = () => {
      void refresh();
    };
    window.addEventListener("studio-shell-updated", handleShellUpdated);

    return () => {
      mounted = false;
      window.removeEventListener("studio-shell-updated", handleShellUpdated);
    };
  }, []);

  const activeShellMapping = useMemo<ActiveShellMapping>(() => {
    const activeShell = resolveActiveShell(shells);
    if (!activeShell) {
      return {
        navbarBlockNames: [],
        footerBlockNames: []
      };
    }

    const lookup = new Map(blocks.map((block) => [block.key, block.name] as const));
    return {
      navbarBlockNames: activeShell.navbarBlocks.map((key) => lookup.get(key) ?? key),
      footerBlockNames: activeShell.footerBlocks.map((key) => lookup.get(key) ?? key)
    };
  }, [blocks, shells]);

  return (
    <div>
      <div data-testid="studio-shell-global-navbar" className="mb-4 rounded-xl border border-white/[0.08] bg-white/[0.02] px-3 py-2">
        <p className="text-[11px] font-semibold text-slate-300">Global Navbar Block Mapping</p>
        <p className="text-[11px] text-slate-500">
          {activeShellMapping.navbarBlockNames.length > 0
            ? activeShellMapping.navbarBlockNames.join(", ")
            : "No mapped navbar blocks"}
        </p>
      </div>
      {children}
      <div data-testid="studio-shell-global-footer" className="mt-4 rounded-xl border border-white/[0.08] bg-white/[0.02] px-3 py-2">
        <p className="text-[11px] font-semibold text-slate-300">Global Footer Block Mapping</p>
        <p className="text-[11px] text-slate-500">
          {activeShellMapping.footerBlockNames.length > 0
            ? activeShellMapping.footerBlockNames.join(", ")
            : "No mapped footer blocks"}
        </p>
      </div>
    </div>
  );
}
