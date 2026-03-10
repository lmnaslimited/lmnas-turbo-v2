import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { StudioActionMenu } from "./StudioActionMenu";
import { StudioDetailContainer } from "./StudioDetailContainer";
import { StudioListContainer } from "./StudioListContainer";
import WorkflowFoundationMockPage from "../../workflow-foundation-mock/page";

describe("studio workflow foundation containers", () => {
  it("renders list/detail/action containers in empty state without crashing", () => {
    const html = renderToStaticMarkup(
      <div>
        <StudioListContainer<{ id: string; title: string }>
          title="List"
          items={[]}
          getItemTitle={(item) => item.title}
          emptyTitle="Empty list"
          emptyDescription="No list rows."
        />
        <StudioDetailContainer
          title="Detail"
          isEmpty
          emptyTitle="Empty detail"
          emptyDescription="No detail rows."
        />
        <StudioActionMenu title="Actions" items={[]} emptyTitle="Empty actions" emptyDescription="No action rows." />
      </div>
    );

    expect(html).toContain("Empty list");
    expect(html).toContain("Empty detail");
    expect(html).toContain("Empty actions");
    expect(html).toContain("data-testid=\"studio-list-empty\"");
    expect(html).toContain("data-testid=\"studio-detail-empty\"");
    expect(html).toContain("data-testid=\"studio-action-menu-empty\"");
  });

  it("renders the workflow foundation mock route", () => {
    const html = renderToStaticMarkup(<WorkflowFoundationMockPage />);
    expect(html).toContain("Workflow Foundation Mock");
    expect(html).toContain("List Container");
    expect(html).toContain("Detail Container");
    expect(html).toContain("Action Menu Container");
  });
});
