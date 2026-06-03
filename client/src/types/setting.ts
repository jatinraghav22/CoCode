interface Settings {
    theme: string
    fontSize: number
    fontFamily: string
    showGitHubCorner: boolean
}

interface SettingsContext extends Settings {
    setTheme: (theme: string) => void
    setFontSize: (fontSize: number) => void
    setFontFamily: (fontFamily: string) => void
    setShowGitHubCorner: (showGitHubCorner: boolean) => void
    resetSettings: () => void
}

export { Settings, SettingsContext }
