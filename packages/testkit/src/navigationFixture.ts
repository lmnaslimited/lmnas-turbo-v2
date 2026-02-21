import type { Navigation } from "@lmnas/contracts";

export const mainNavigationFixture: Navigation = {
  id: 1,
  key: "main",
  items: [
    {
      label: "Products",
      children: [{ label: "CPQ", href: "/products/cpq" }]
    },
    {
      label: "Solutions",
      children: [{ label: "Tender Intelligence", href: "/solutions/tender-intelligence" }]
    },
    {
      label: "Industries",
      children: [{ label: "Healthcare", href: "/industries/healthcare" }]
    }
  ]
};

export const footerNavigationFixture: Navigation = {
  id: 2,
  key: "footer",
  items: [
    { label: "About", href: "/about" },
    { label: "Blogs", href: "/blogs" }
  ]
};
