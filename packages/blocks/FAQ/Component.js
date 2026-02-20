import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
export function FAQBlockComponent({ block }) {
    return (_jsxs("section", { style: { padding: 20, border: "1px solid #ddd", borderRadius: 8, marginBottom: 12 }, children: [_jsx("h2", { children: block.title }), _jsx("ul", { children: block.items.map((item, idx) => (_jsxs("li", { children: [_jsx("strong", { children: item.question }), _jsx("p", { children: item.answer })] }, `${item.question}-${idx}`))) })] }));
}
