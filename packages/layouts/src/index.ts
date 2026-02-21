import type { LayoutKey } from "@lmnas/contracts";

type LayoutProps = {
  title: string;
  children: any;
};

function passthroughLayout({ children }: LayoutProps) {
  return children;
}

export const LayoutRegistry: Record<LayoutKey, (props: LayoutProps) => any> = {
  homeLayout: passthroughLayout,
  productLayout: passthroughLayout,
  solutionLayout: passthroughLayout,
  industryLayout: passthroughLayout,
  simpleLayout: passthroughLayout
};
