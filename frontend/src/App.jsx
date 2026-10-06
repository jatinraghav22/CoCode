import { Route, BrowserRouter as Router, Routes, Navigate } from "react-router-dom"
import Toast from "./components/toast/Toast"
import HomePage from "./pages/HomePage"
import LoginPage from "./pages/LoginPage"
import RegisterPage from "./pages/RegisterPage"
import ForgotPasswordPage from "./pages/ForgotPasswordPage"
import PersonalCompilerPage from "./pages/PersonalCompilerPage"
import CreateRoomPage from "./pages/CreateRoomPage"
import JoinRoomPage from "./pages/JoinRoomPage"
import DashboardPage from "./pages/DashboardPage"
import WorkspacePage from "./pages/WorkspacePage"
import ProfilePage from "./pages/ProfilePage"
import ProjectsPage from "./pages/ProjectsPage"
import EditorPage from "./pages/EditorPage"
import ProtectedRoute from "./components/auth/ProtectedRoute"

const App = () => {
    return (
        <>
            <Router>
                <Routes>
                    {/* Public Routes */}
                    <Route path="/" element={<HomePage />} />
                    <Route path="/login" element={<LoginPage />} />
                    <Route path="/register" element={<RegisterPage />} />
                    <Route path="/forgot-password" element={<ForgotPasswordPage />} />

                    {/* Protected Routes */}
                    <Route element={<ProtectedRoute />}>
                        {/* Default after login */}
                        <Route path="/compiler" element={<PersonalCompilerPage />} />
                        
                        {/* Collaboration Room Routes */}
                        <Route path="/create-room" element={<CreateRoomPage />} />
                        <Route path="/join-room" element={<JoinRoomPage />} />
                        <Route path="/room/:roomId" element={<EditorPage />} />
                        <Route path="/editor/:roomId" element={<EditorPage />} />
                        
                        {/* Workspaces & Hub */}
                        <Route path="/dashboard" element={<DashboardPage />} />
                        <Route path="/rooms" element={<DashboardPage />} />
                        <Route path="/workspace" element={<WorkspacePage />} />
                        <Route path="/projects" element={<ProjectsPage />} />
                        <Route path="/profile" element={<ProfilePage />} />
                    </Route>

                    {/* Catch-all */}
                    <Route path="*" element={<Navigate to="/" replace />} />
                </Routes>
            </Router>
            <Toast />
        </>
    )
}

export default App
