import useLocalStorage from "@/hooks/useLocalStorage"
import {
    Settings,
    SettingsContext as SettingsContextType,
} from "@/types/setting"
import {
    ReactNode,
    createContext,
    useContext,
    useEffect,
    useState,
} from "react"

const SettingContext = createContext<SettingsContextType | null>(null)

export const useSettings = (): SettingsContextType => {
    const context = useContext(SettingContext)
    if (!context) {
        throw new Error(
            "useSettings must be used within a SettingContextProvider",
        )
    }
    return context
}

const defaultSettings: Settings = {
    theme: "Dracula",
    fontSize: 16,
    fontFamily: "Space Mono",
    showGitHubCorner: true,
}

function SettingContextProvider({ children }: { children: ReactNode }) {
    const { getItem } = useLocalStorage()
    const storedSettings: Partial<Settings> = JSON.parse(
        getItem("settings") || "{}",
    )
    const storedTheme =
        storedSettings.theme !== undefined
            ? storedSettings.theme
            : defaultSettings.theme
    const storedFontSize =
        storedSettings.fontSize !== undefined
            ? storedSettings.fontSize
            : defaultSettings.fontSize
    const storedFontFamily =
        storedSettings.fontFamily !== undefined
            ? storedSettings.fontFamily
            : defaultSettings.fontFamily
    const storedShowGitHubCorner =
        storedSettings.showGitHubCorner !== undefined
            ? storedSettings.showGitHubCorner
            : defaultSettings.showGitHubCorner

    const [theme, setTheme] = useState<string>(storedTheme)
    const [fontSize, setFontSize] = useState<number>(storedFontSize)
    const [fontFamily, setFontFamily] = useState<string>(storedFontFamily)
    const [showGitHubCorner, setShowGitHubCorner] = useState<boolean>(
        storedShowGitHubCorner,
    )

    const resetSettings = () => {
        setTheme(defaultSettings.theme)
        setFontSize(defaultSettings.fontSize)
        setFontFamily(defaultSettings.fontFamily)
        setShowGitHubCorner(defaultSettings.showGitHubCorner)
    }

    useEffect(() => {
        // Save settings to local storage whenever they change
        const updatedSettings = {
            theme,
            fontSize,
            fontFamily,
            showGitHubCorner,
        }
        localStorage.setItem("settings", JSON.stringify(updatedSettings))
    }, [theme, fontSize, fontFamily, showGitHubCorner])

    return (
        <SettingContext.Provider
            value={{
                theme,
                setTheme,
                fontSize,
                setFontSize,
                fontFamily,
                setFontFamily,
                showGitHubCorner,
                setShowGitHubCorner,
                resetSettings,
            }}
        >
            {children}
        </SettingContext.Provider>
    )
}

export { SettingContextProvider }
export default SettingContext
