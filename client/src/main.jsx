import { StrictMode, lazy, Suspense } from "react";
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
import { ThemeProvider } from "./ThemeContext.jsx";
import { AuthProvider, useAuth } from "./AuthContext.jsx";
import ProtectedRoute from "./components/ProtectedRoute.jsx";

// Route-level code splitting to optimize bundle size and speed up page load
const Dashboard = lazy(() => import("./pages/Dashboard.jsx"));
const EditorPage = lazy(() => import("./pages/EditorPage.jsx"));
const Compiler = lazy(() => import("./pages/Compiler.jsx"));
const Login = lazy(() => import("./pages/Login.jsx"));
const Signup = lazy(() => import("./pages/Signup.jsx"));
const RoomPage = lazy(() => import("./pages/RoomPage.jsx"));
const Settings = lazy(() => import("./pages/Settings.jsx"));
const Profile = lazy(() => import("./pages/Profile.jsx"));

function PageLoader() {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        minHeight: "100vh",
        backgroundColor: "#0a0e17",
        color: "#6366f1",
      }}
    >
      <div
        style={{
          width: 36,
          height: 36,
          border: "3px solid rgba(99, 102, 241, 0.2)",
          borderTopColor: "#6366f1",
          borderRadius: "50%",
          animation: "cocode-spin 0.8s linear infinite",
        }}
      />
      <style>{`@keyframes cocode-spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

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
          <Suspense fallback={<PageLoader />}>
            <Routes>
              {/* Conditional Root: Guest Homepage or Authenticated Dashboard */}
              <Route path="/" element={<RootRoute />} />

              {/* Standalone Public Compiler (Available to both guests and users) */}
              <Route path="/compiler" element={<Compiler />} />

              {/* Professional Online IDE matching reference: /editor and /editor/:roomId */}
              <Route path="/editor" element={<EditorPage />} />
              <Route path="/editor/:roomId" element={<EditorPage />} />

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
          </Suspense>
        </BrowserRouter>
      </ThemeProvider>
    </AuthProvider>
  </StrictMode>
);
