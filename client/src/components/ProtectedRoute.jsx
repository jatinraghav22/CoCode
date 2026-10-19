import React from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../AuthContext.jsx";
import { LoaderCircle } from "lucide-react";

/**
 * Route guard component that protects private pages.
 * If user is not authenticated, redirects them to /login and preserves their intended destination.
 */
export default function ProtectedRoute({ children }) {
  const { isAuthenticated, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div
        style={{
          minHeight: "100vh",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          background: "#080914",
          color: "#c4b5fd",
          gap: 16,
          fontFamily: "Inter, sans-serif",
        }}
      >
        <LoaderCircle
          size={32}
          style={{ animation: "spin 1s linear infinite" }}
          aria-hidden="true"
        />
        <span>Checking authorization...</span>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  if (!isAuthenticated) {
    // Save intended destination so login can resume it
    const destination = location.pathname + location.search;
    return <Navigate to={`/login?redirect=${encodeURIComponent(destination)}`} replace state={{ from: location }} />;
  }

  return children;
}
