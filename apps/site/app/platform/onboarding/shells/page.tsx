"use client";

import React, { useEffect, useMemo, useState } from "react";
import type { StudioBlockTemplate, StudioShell } from "../_lib/studio-types";
import { requestClientJson } from "../_lib/client-request";
import { StudioActionMenu, StudioDetailContainer, StudioListContainer } from "../_components/workflow";

export default function ShellWorkflowPage(): React.ReactElement {
  const [shells, setShells] = useState<StudioShell[]>([]);
  const [blocks, setBlocks] = useState<StudioBlockTemplate[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isActivating, setIsActivating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function loadShells(): Promise<void> {
    setIsLoading(true);
    setError(null);
    try {
      const payload = await requestClientJson<{
        ok: boolean;
        data?: StudioShell[];
        error?: string;
      }>(
        "/api/platform/studio/shells",
        {
          method: "GET",
          headers: { "content-type": "application/json" }
        },
        {
          timeoutMessage: "Loading shells timed out. Please retry.",
          fallbackErrorMessage: "Unable to load shells."
        }
      );

      if (!payload.ok || !payload.data) {
        throw new Error(payload.error ?? "Unable to load shells.");
      }

      setShells(payload.data);
      if (!selectedId && payload.data.length > 0) {
        setSelectedId(payload.data[0].id);
      }
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : String(loadError));
    } finally {
      setIsLoading(false);
    }
  }

  async function loadBlocks(): Promise<void> {
    try {
      const payload = await requestClientJson<{
        ok: boolean;
        data?: StudioBlockTemplate[];
        error?: string;
      }>(
        "/api/platform/studio/blocks",
        {
          method: "GET",
          headers: { "content-type": "application/json" }
        },
        {
          timeoutMessage: "Loading block library timed out. Please retry.",
          fallbackErrorMessage: "Unable to load block library."
        }
      );
      if (!payload.ok || !payload.data) {
        throw new Error(payload.error ?? "Unable to load block library.");
      }
      setBlocks(payload.data);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : String(loadError));
    }
  }

  useEffect(() => {
    void loadShells();
    void loadBlocks();
  }, []);

  const selectedShell = shells.find((shell) => shell.id === selectedId) ?? null;

  const blockIndex = useMemo(() => {
    return new Map(blocks.map((block) => [block.key, block] as const));
  }, [blocks]);

  async function saveShell(nextShell: StudioShell): Promise<void> {
    setIsSaving(true);
    setError(null);
    try {
      const payload = await requestClientJson<{
        ok: boolean;
        data?: StudioShell[];
        error?: string;
      }>(
        "/api/platform/studio/shells",
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ shell: nextShell })
        },
        {
          timeoutMessage: "Saving shell timed out. Please retry.",
          fallbackErrorMessage: "Unable to save shell."
        }
      );
      if (!payload.ok || !payload.data) {
        throw new Error(payload.error ?? "Unable to save shell.");
      }
      setShells(payload.data);
      window.dispatchEvent(new Event("studio-shell-updated"));
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : String(saveError));
    } finally {
      setIsSaving(false);
    }
  }

  async function activateShell(shell: StudioShell): Promise<void> {
    setIsActivating(true);
    setError(null);
    try {
      const payload = await requestClientJson<{
        ok: boolean;
        data?: StudioShell[];
        error?: string;
      }>(
        "/api/platform/studio/shells/activate",
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ id: shell.id, key: shell.key })
        },
        {
          timeoutMessage: "Activating shell timed out. Please retry.",
          fallbackErrorMessage: "Unable to activate shell."
        }
      );
      if (!payload.ok || !payload.data) {
        throw new Error(payload.error ?? "Unable to activate shell.");
      }
      setShells(payload.data);
      window.dispatchEvent(new Event("studio-shell-updated"));
    } catch (activationError) {
      setError(activationError instanceof Error ? activationError.message : String(activationError));
    } finally {
      setIsActivating(false);
    }
  }

  function resolveMappedBlockNames(keys: string[]): string[] {
    return keys.map((key) => blockIndex.get(key)?.name ?? key);
  }

  const shellActions = selectedShell
    ? [
        {
          id: "activate",
          label: selectedShell.status === "active" ? "Already Active" : "Activate Shell",
          description:
            selectedShell.status === "active"
              ? "This shell is currently active."
              : "Promote this shell globally across onboarding context wrappers.",
          tone: "accent" as const,
          disabled: selectedShell.status === "active" || isActivating,
          onSelect: () => {
            void activateShell(selectedShell);
          }
        },
        {
          id: "deactivate",
          label: "Set Inactive",
          description: "Archive this shell variant without deletion.",
          tone: "neutral" as const,
          disabled: selectedShell.status === "inactive" || isSaving,
          onSelect: () => {
            void saveShell({
              ...selectedShell,
              status: "inactive"
            });
          }
        },
        {
          id: "add-action",
          label: "Add Shell Action",
          description: "Append a CTA action to the selected shell.",
          tone: "neutral" as const,
          disabled: isSaving,
          onSelect: () => {
            void saveShell({
              ...selectedShell,
              actions: [
                ...selectedShell.actions,
                {
                  id: `sa-${Date.now()}`,
                  label: "New Action",
                  type: "link_url",
                  target: "/"
                }
              ]
            });
          }
        }
      ]
    : [];

  return (
    <div className="mx-auto flex w-full max-w-[1320px] flex-col gap-5">
      <header>
        <h1 className="text-xl font-bold text-slate-100">Shell Workflow</h1>
        <p className="mt-1 text-xs text-slate-500">
          Configure global navbar/footer shell mappings. Shell block arrays propagate through onboarding context wrappers.
        </p>
      </header>

      {error ? (
        <div className="rounded-lg border border-red-500/25 bg-red-500/[0.08] px-3 py-2">
          <p className="text-xs text-red-300">{error}</p>
        </div>
      ) : null}

      <div className="grid gap-5 lg:grid-cols-[330px_1fr]">
        <StudioListContainer
          title="Shell Variants"
          description={isLoading ? "Loading shells…" : "Browse navbar/footer/full shell variants."}
          items={shells}
          selectedId={selectedId}
          onSelectItem={(shell) => setSelectedId(shell.id)}
          getItemTestId={(shell) => `shell-card-${shell.id}`}
          getItemTitle={(shell) => shell.name}
          getItemSubtitle={(shell) => `${shell.role} • ${shell.status}`}
          getItemMeta={(shell) => `menu ${shell.menuItems.length} • actions ${shell.actions.length}`}
          emptyTitle="No shell variants"
          emptyDescription="Create or import shell variants to configure global wrappers."
        />

        <div className="flex flex-col gap-5">
          <StudioDetailContainer
            title={selectedShell ? selectedShell.name : "Shell Detail"}
            description={selectedShell ? `${selectedShell.role} shell` : "Select a shell to configure."}
            isEmpty={!selectedShell}
            emptyTitle="No shell selected"
            emptyDescription="Pick a shell row to configure block-array mappings."
            headerSlot={
              selectedShell ? (
                <span className="rounded-lg border border-white/[0.08] bg-white/[0.04] px-2 py-1 text-[11px] text-slate-300">
                  {selectedShell.status}
                </span>
              ) : null
            }
          >
            {selectedShell ? (
              <div className="space-y-4">
                <iframe
                  className="w-full rounded-lg border border-white/[0.08] bg-white"
                  style={{ minHeight: "200px" }}
                  srcDoc={""}
                  sandbox="allow-scripts allow-same-origin"
                  title={selectedShell.name}
                />

                <div data-testid="shell-block-mapping" className="rounded-xl border border-white/[0.08] bg-white/[0.02] p-3">
                  <p className="text-xs font-semibold text-slate-300">Navbar/Footer Block Array Mapping</p>
                  <p className="mt-1 text-[11px] text-slate-500">
                    These arrays map shell config directly to reusable blocks for global wrapper rendering.
                  </p>

                  <div className="mt-3 grid gap-3 md:grid-cols-2">
                    <div className="rounded-lg border border-white/[0.08] bg-white/[0.015] p-2.5">
                      <p className="text-[11px] font-semibold text-slate-300">Navbar Blocks</p>
                      <div className="mt-2 max-h-[200px] space-y-1 overflow-y-auto pr-1">
                        {blocks.map((block) => {
                          const checked = selectedShell.navbarBlocks.includes(block.key);
                          return (
                            <label key={`navbar-${block.id}`} className="flex items-center gap-2 text-xs text-slate-400">
                              <input
                                data-testid={`shell-navbar-map-${block.key}`}
                                type="checkbox"
                                checked={checked}
                                onChange={(event) => {
                                  const nextNavbarBlocks = event.target.checked
                                    ? [...selectedShell.navbarBlocks, block.key]
                                    : selectedShell.navbarBlocks.filter((key) => key !== block.key);
                                  void saveShell({
                                    ...selectedShell,
                                    navbarBlocks: Array.from(new Set(nextNavbarBlocks))
                                  });
                                }}
                              />
                              <span>{block.name}</span>
                            </label>
                          );
                        })}
                      </div>
                    </div>

                    <div className="rounded-lg border border-white/[0.08] bg-white/[0.015] p-2.5">
                      <p className="text-[11px] font-semibold text-slate-300">Footer Blocks</p>
                      <div className="mt-2 max-h-[200px] space-y-1 overflow-y-auto pr-1">
                        {blocks.map((block) => {
                          const checked = selectedShell.footerBlocks.includes(block.key);
                          return (
                            <label key={`footer-${block.id}`} className="flex items-center gap-2 text-xs text-slate-400">
                              <input
                                data-testid={`shell-footer-map-${block.key}`}
                                type="checkbox"
                                checked={checked}
                                onChange={(event) => {
                                  const nextFooterBlocks = event.target.checked
                                    ? [...selectedShell.footerBlocks, block.key]
                                    : selectedShell.footerBlocks.filter((key) => key !== block.key);
                                  void saveShell({
                                    ...selectedShell,
                                    footerBlocks: Array.from(new Set(nextFooterBlocks))
                                  });
                                }}
                              />
                              <span>{block.name}</span>
                            </label>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="grid gap-3 md:grid-cols-2">
                  <div className="rounded-lg border border-white/[0.08] bg-white/[0.02] p-2.5">
                    <p className="text-[11px] font-semibold text-slate-300">Mapped Navbar Blocks</p>
                    <ul className="mt-1 space-y-1">
                      {resolveMappedBlockNames(selectedShell.navbarBlocks).map((name) => (
                        <li key={name} className="text-xs text-slate-400">
                          {name}
                        </li>
                      ))}
                      {selectedShell.navbarBlocks.length === 0 ? <li className="text-xs text-slate-500">No navbar blocks mapped.</li> : null}
                    </ul>
                  </div>
                  <div className="rounded-lg border border-white/[0.08] bg-white/[0.02] p-2.5">
                    <p className="text-[11px] font-semibold text-slate-300">Mapped Footer Blocks</p>
                    <ul className="mt-1 space-y-1">
                      {resolveMappedBlockNames(selectedShell.footerBlocks).map((name) => (
                        <li key={name} className="text-xs text-slate-400">
                          {name}
                        </li>
                      ))}
                      {selectedShell.footerBlocks.length === 0 ? <li className="text-xs text-slate-500">No footer blocks mapped.</li> : null}
                    </ul>
                  </div>
                </div>
              </div>
            ) : null}
          </StudioDetailContainer>

          <StudioActionMenu
            title="Shell Actions"
            description="Activate, archive, or append actions while preserving global shell scope."
            items={shellActions}
          />
        </div>
      </div>
    </div>
  );
}
