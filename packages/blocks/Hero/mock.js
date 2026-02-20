import defaults from "./defaults.json";
export function getHeroMock() {
    return {
        type: "hero",
        ...defaults
    };
}
