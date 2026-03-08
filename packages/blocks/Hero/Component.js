import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
export function HeroBlockComponent({ block }) {
    const ctaLabel = block.primaryCta.label;
    const ctaHref = block.primaryCta.href;
    return (_jsxs("section", { className: "lmnas-hero-block", children: [_jsx("h2", { children: block.heading }), _jsx("p", { children: block.subheading }), _jsx("a", { href: ctaHref, "data-exit-id": block.primaryCta.exitId, children: ctaLabel })] }));
}
