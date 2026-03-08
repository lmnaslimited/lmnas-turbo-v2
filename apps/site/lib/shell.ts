import type { Page } from "@lmnas/contracts";
import { getNavigationByKey } from "@lmnas/integrations";
import type { ShellRenderModel } from "@lmnas/layouts";

export async function buildShellRenderModel(page: Pick<Page, "shellAssignment">): Promise<ShellRenderModel> {
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
