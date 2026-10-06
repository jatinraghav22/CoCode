import { AuthProvider } from "./AuthContext"
import { AppContextProvider } from "./AppContext"
import { ChatContextProvider } from "./ChatContext"
import { FileContextProvider } from "./FileContext"
import { PersonalWorkspaceProvider } from "./PersonalWorkspaceContext"
import { RunCodeContextProvider } from "./RunCodeContext"
import { SettingContextProvider } from "./SettingContext"
import { SocketProvider } from "./SocketContext"
import { ViewContextProvider } from "./ViewContext"
import { CopilotContextProvider } from "./CopilotContext"

function AppProvider({ children }) {
    return (
        <AuthProvider>
            <AppContextProvider>
                <SocketProvider>
                    <SettingContextProvider>
                        <ViewContextProvider>
                            <FileContextProvider>
                                <PersonalWorkspaceProvider>
                                    <CopilotContextProvider>
                                        <RunCodeContextProvider>
                                            <ChatContextProvider>
                                                {children}
                                            </ChatContextProvider>
                                        </RunCodeContextProvider>
                                    </CopilotContextProvider>
                                </PersonalWorkspaceProvider>
                            </FileContextProvider>
                        </ViewContextProvider>
                    </SettingContextProvider>
                </SocketProvider>
            </AppContextProvider>
        </AuthProvider>
    )
}

export default AppProvider
