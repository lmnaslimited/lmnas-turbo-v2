import React from "react";
import type { LayoutKey } from "@lmnas/contracts";

type LayoutProps = {
  title: string;
  children: React.ReactNode;
};

function BaseLayout({ title, children, accent }: LayoutProps & { accent: string }) {
  return (
    <section style={{ border: `2px solid ${accent}`, borderRadius: 8, padding: 16, marginBottom: 24 }}>
      <p style={{ marginTop: 0, fontWeight: 600 }}>Layout: {title}</p>
      {children}
    </section>
  );
}

const HomeLayout = ({ title, children }: LayoutProps) => <BaseLayout title={title} accent="#175CD3">{children}</BaseLayout>;
const ProductLayout = ({ title, children }: LayoutProps) => (
  <BaseLayout title={title} accent="#0E9F6E">{children}</BaseLayout>
);
const SolutionLayout = ({ title, children }: LayoutProps) => (
  <BaseLayout title={title} accent="#B54708">{children}</BaseLayout>
);
const IndustryLayout = ({ title, children }: LayoutProps) => (
  <BaseLayout title={title} accent="#93370D">{children}</BaseLayout>
);
const SimpleLayout = ({ title, children }: LayoutProps) => <BaseLayout title={title} accent="#475467">{children}</BaseLayout>;

export const LayoutRegistry: Record<LayoutKey, React.ComponentType<LayoutProps>> = {
  homeLayout: HomeLayout,
  productLayout: ProductLayout,
  solutionLayout: SolutionLayout,
  industryLayout: IndustryLayout,
  simpleLayout: SimpleLayout
};
