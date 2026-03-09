import type { Page } from "@lmnas/contracts";
import { getNavigationByKey } from "@lmnas/integrations";
import type { ShellRenderModel } from "@lmnas/layouts";

function hasImportedSnapshotBlock(page: Pick<Page, "blocks">): boolean {
  return page.blocks.some((block) => block.type === "imported_dom_snapshot");
}

export async function buildShellRenderModel(page: Pick<Page, "shellAssignment" | "blocks">): Promise<ShellRenderModel> {
  if (hasImportedSnapshotBlock(page)) {
    return {
      assignment: page.shellAssignment,
      mainNavigation: {
        key: "main",
        items: []
      },
      footerNavigation: {
        key: "footer",
        items: []
      },
      utilityNavigation: {
        key: "utility",
        items: []
      }
    };
  }

  const [mainNavigation, footerNavigation, utilityNavigation] = await Promise.all([
    getNavigationByKey("main"),
    getNavigationByKey("footer"),
    getNavigationByKey("utility")
  ]);

  return {
    assignment: page.shellAssignment,
    mainNavigation,
    footerNavigation,
    utilityNavigation
  };
}
