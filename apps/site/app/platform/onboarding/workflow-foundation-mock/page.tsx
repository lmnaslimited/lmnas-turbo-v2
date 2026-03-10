import React from "react";
import { StudioActionMenu, StudioDetailContainer, StudioListContainer } from "../_components/workflow";

type MockListRow = {
  id: string;
  title: string;
};

const EMPTY_LIST: MockListRow[] = [];

export default function WorkflowFoundationMockPage(): React.ReactElement {
  return (
    <div className="mx-auto flex w-full max-w-[1320px] flex-col gap-5">
      <header data-testid="workflow-foundation-heading">
        <h1 className="text-xl font-bold text-slate-100">Workflow Foundation Mock</h1>
        <p className="mt-1 text-xs text-slate-500">
          Generic list, detail, and action menu containers for future Studio workflows.
        </p>
      </header>

      <div className="grid gap-5 lg:grid-cols-[330px_1fr]">
        <StudioListContainer
          title="List Container"
          description="Shared browse/index surface used by theme, block, shell, and page workflows."
          items={EMPTY_LIST}
          getItemTitle={(item) => item.title}
          emptyTitle="No workflow items loaded"
          emptyDescription="This is the baseline empty-state rendering for Studio list views."
        />

        <div className="flex flex-col gap-5">
          <StudioDetailContainer
            title="Detail Container"
            description="Shared inspector surface for selected workflow entities."
            isEmpty
            emptyTitle="No detail content yet"
            emptyDescription="Detail panes render this state until a list row is selected."
          />
          <StudioActionMenu
            title="Action Menu Container"
            description="Shared action rail for activate, archive, duplicate, and delete commands."
            items={[]}
            emptyTitle="No actions available"
            emptyDescription="Action controls appear after workflow-specific handlers are attached."
          />
        </div>
      </div>
    </div>
  );
}
