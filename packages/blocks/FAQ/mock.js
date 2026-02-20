import defaults from "./defaults.json";
export function getFAQMock() {
    return {
        type: "faq",
        ...defaults
    };
}
