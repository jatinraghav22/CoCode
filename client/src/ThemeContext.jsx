
import {
    createContext,
    useContext,
    useEffect,
    useState,
} from "react";

export const DEFAULT_THEME = "arctic";

export const THEME_OPTIONS = [
    {
        id: "violet",
        name: "Neon Violet + Cyan",
        description: "Futuristic and vibrant",
        colors: ["#080914", "#7848F7", "#65E7FF", "#B79AFF"],
        tokens: {
            bg: "#080914",
            surface: "#13152B",
            raised: "#1B1D39",
            primary: "#7848F7",
            secondary: "#65E7FF",
            accent: "#B79AFF",
            text: "#F1F2FF",
            muted: "#A1A6C3",
            border: "rgba(170,173,229,0.17)",
            glow: "rgba(120,72,247,0.20)",
        },
    },
    {
        id: "cyberpunk",
        name: "Cyberpunk Pink + Blue",
        description: "Bold and energetic",
        colors: ["#090817", "#FF3EA5", "#00D9FF", "#8B5CFF"],
        tokens: {
            bg: "#090817",
            surface: "#151229",
            raised: "#211B3A",
            primary: "#FF3EA5",
            secondary: "#00D9FF",
            accent: "#8B5CFF",
            text: "#FFF2FA",
            muted: "#B5A3C5",
            border: "rgba(255,62,165,0.18)",
            glow: "rgba(255,62,165,0.20)",
        },
    },
    {
        id: "emerald",
        name: "Emerald + Mint",
        description: "Clean and modern",
        colors: ["#071411", "#16A34A", "#2DD4BF", "#A7F3D0"],
        tokens: {
            bg: "#071411",
            surface: "#0F221E",
            raised: "#15352D",
            primary: "#16A34A",
            secondary: "#2DD4BF",
            accent: "#A7F3D0",
            text: "#E8FFF5",
            muted: "#9ABDB1",
            border: "rgba(45,212,191,0.17)",
            glow: "rgba(22,163,74,0.20)",
        },
    },
    {
        id: "royal",
        name: "Royal Purple + Orange",
        description: "Warm and cinematic",
        colors: ["#100D1D", "#7C3AED", "#F59E0B", "#FB7185"],
        tokens: {
            bg: "#100D1D",
            surface: "#201632",
            raised: "#2B2041",
            primary: "#7C3AED",
            secondary: "#F59E0B",
            accent: "#FB7185",
            text: "#FFF5EE",
            muted: "#B6A3BE",
            border: "rgba(245,158,11,0.17)",
            glow: "rgba(124,58,237,0.21)",
        },
    },
    {
        id: "arctic",
        name: "Arctic Blue + Silver",
        description: "Professional and polished",
        colors: ["#07111F", "#2563EB", "#38BDF8", "#CBD5E1"],
        tokens: {
            bg: "#07111F",
            surface: "#101D30",
            raised: "#17263B",
            primary: "#2563EB",
            secondary: "#38BDF8",
            accent: "#CBD5E1",
            text: "#F1F5F9",
            muted: "#94A3B8",
            border: "rgba(148,163,184,0.19)",
            glow: "rgba(37,99,235,0.19)",
        },
    },
];

const ThemeContext = createContext(null);
const STORAGE_KEY = "cocode-theme";

function readSavedTheme() {
    try {
        const saved = localStorage.getItem(STORAGE_KEY);

        return THEME_OPTIONS.some((theme) => theme.id === saved)
            ? saved
            : DEFAULT_THEME;
    } catch {
        return DEFAULT_THEME;
    }
}

export function ThemeProvider({ children }) {
    const [theme, setTheme] = useState(readSavedTheme);

    const activeTheme =
        THEME_OPTIONS.find((item) => item.id === theme) ??
        THEME_OPTIONS.find((item) => item.id === DEFAULT_THEME);

    useEffect(() => {
        const root = document.documentElement;
        const { tokens } = activeTheme;

        root.dataset.cocodeTheme = activeTheme.id;

        root.style.setProperty("--cc-bg", tokens.bg);
        root.style.setProperty("--cc-surface", tokens.surface);
        root.style.setProperty("--cc-raised", tokens.raised);
        root.style.setProperty("--cc-primary", tokens.primary);
        root.style.setProperty("--cc-secondary", tokens.secondary);
        root.style.setProperty("--cc-accent", tokens.accent);
        root.style.setProperty("--cc-text", tokens.text);
        root.style.setProperty("--cc-muted", tokens.muted);
        root.style.setProperty("--cc-border", tokens.border);
        root.style.setProperty("--cc-glow", tokens.glow);
        root.style.setProperty(
            "--cc-gradient",
            `linear-gradient(105deg, ${tokens.primary}, ${tokens.secondary})`
        );

        try {
            localStorage.setItem(STORAGE_KEY, activeTheme.id);
        } catch {
            // Theme still works for the current session if storage is unavailable.
        }
    }, [activeTheme]);

    function changeTheme(nextTheme) {
        if (THEME_OPTIONS.some((item) => item.id === nextTheme)) {
            setTheme(nextTheme);
        }
    }

    return (
        <ThemeContext.Provider
            value={{
                theme: activeTheme.id,
                activeTheme,
                themes: THEME_OPTIONS,
                changeTheme,
            }}
        >
            {children}
        </ThemeContext.Provider>
    );
}

export function useTheme() {
    const context = useContext(ThemeContext);

    if (!context) {
        throw new Error("useTheme must be used inside ThemeProvider");
    }

    return context;
}
