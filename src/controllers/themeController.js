const ALLOWED_THEMES = ["arcade", "sunset", "forest"];

export function normalizeThemePreset(themePreset) {
    const raw = typeof themePreset === "string" ? themePreset.trim().toLowerCase() : "";
    return ALLOWED_THEMES.includes(raw) ? raw : "arcade";
}

export function getThemeCssClass(themePreset) {
    return `theme-${normalizeThemePreset(themePreset)}`;
}

export function getAllowedThemePresets() {
    return [...ALLOWED_THEMES];
}
