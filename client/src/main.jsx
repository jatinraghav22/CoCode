import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import {
  BrowserRouter,
  Navigate,
  Route,
  Routes,
} from "react-router-dom";

import "./index.css";
import "./theme-arctic.css";

import App from "./App.jsx";
import Dashboard from "./pages/Dashboard.jsx";
import Compiler from "./pages/Compiler.jsx";
import Login from "./pages/Login.jsx";
import Signup from "./pages/Signup.jsx";
import RoomPage from "./pages/RoomPage.jsx";
import Settings from "./pages/Settings.jsx";
import Profile from "./pages/Profile.jsx";
import { ThemeProvider } from "./ThemeContext.jsx";
import { AuthProvider, useAuth } from "./AuthContext.jsx";
import ProtectedRoute from "./components/ProtectedRoute.jsx";

// Renders Guest Homepage or redirects authenticated users to /dashboard
function RootRoute() {
  const { isAuthenticated, loading } = useAuth();
  if (loading) return null;
  return isAuthenticated ? <Navigate to="/dashboard" replace /> : <App />;
}

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <AuthProvider>
      <ThemeProvider>
        <BrowserRouter>
          <Routes>
            {/* Conditional Root: Guest Homepage or Authenticated Dashboard */}
            <Route path="/" element={<RootRoute />} />

            {/* Standalone Public Compiler (Available to both guests and users) */}
            <Route path="/compiler" element={<Compiler />} />

            {/* Authentication Pages (Redirect to dashboard/intended action if logged in) */}
            <Route path="/login" element={<Login />} />
            <Route path="/signup" element={<Signup />} />

            {/* Canonical Authenticated Dashboard */}
            <Route
              path="/dashboard"
              element={
                <ProtectedRoute>
                  <Dashboard />
                </ProtectedRoute>
              }
            />
            <Route
              path="/projects"
              element={
                <ProtectedRoute>
                  <Dashboard />
                </ProtectedRoute>
              }
            />

            {/* Protected Collaboration Rooms */}
            <Route
              path="/rooms"
              element={<Navigate to="/rooms/create" replace />}
            />
            <Route
              path="/rooms/create"
              element={
                <ProtectedRoute>
                  <RoomPage mode="create" />
                </ProtectedRoute>
              }
            />
            <Route
              path="/rooms/join"
              element={
                <ProtectedRoute>
                  <RoomPage mode="join" />
                </ProtectedRoute>
              }
            />

            {/* Dedicated Protected Profile Page */}
            <Route
              path="/profile"
              element={
                <ProtectedRoute>
                  <Profile />
                </ProtectedRoute>
              }
            />

            {/* Protected Settings & Edit Profile Pages */}
            <Route
              path="/settings"
              element={
                <ProtectedRoute>
                  <Settings defaultTab="profile" />
                </ProtectedRoute>
              }
            />
            <Route
              path="/settings/profile"
              element={
                <ProtectedRoute>
                  <Settings defaultTab="profile" />
                </ProtectedRoute>
              }
            />
            <Route
              path="/settings/appearance"
              element={
                <ProtectedRoute>
                  <Settings defaultTab="appearance" />
                </ProtectedRoute>
              }
            />

            {/* Fallback to Root */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
      </ThemeProvider>
    </AuthProvider>
  </StrictMode>
);
