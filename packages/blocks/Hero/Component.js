import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
export function HeroBlockComponent({ block }) {
    return (_jsxs("section", { style: { padding: 20, border: "1px solid #ddd", borderRadius: 8, marginBottom: 12 }, children: [_jsx("h2", { children: block.heading }), _jsx("p", { children: block.subheading }), _jsx("a", { href: block.ctaHref, children: block.ctaLabel })] }));
}
