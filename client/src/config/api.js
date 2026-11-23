/**
 * api.js — Centralized API configuration for CoCode
 *
 * Provides a reliable API_BASE URL across all environments (local, Vercel, production).
 */

const envApiUrl = import.meta.env.VITE_API_URL;

function resolveDefaultApiUrl() {
  if (typeof window !== "undefined") {
    const hostname = window.location.hostname;
    const isLocalhost = hostname === "localhost" || hostname === "127.0.0.1";
    // In production (Vercel, getcocode.app, custom domains), if VITE_API_URL is omitted during build,
    // fallback directly to the production Render backend instead of crashing on localhost:5000.
    if (!isLocalhost) {
      return "https://cocode-backend-v2.onrender.com";
    }
  }
  return "http://localhost:5000";
}

export const API_BASE = (envApiUrl || resolveDefaultApiUrl()).replace(/\/+$/, "");
export default API_BASE;