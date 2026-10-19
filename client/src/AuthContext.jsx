import React, { createContext, useContext, useState, useEffect } from "react";

const AuthContext = createContext(null);

const API_BASE = (import.meta.env.VITE_API_URL || "http://localhost:5000").replace(/\/+$/, "");
const TOKEN_KEY = "cocode_auth_token";

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(() => {
    if (typeof window !== "undefined") {
      return window.localStorage.getItem(TOKEN_KEY) || null;
    }
    return null;
  });
  const [loading, setLoading] = useState(true);

  // Validate session on mount
  useEffect(() => {
    let active = true;

    async function checkAuth() {
      const storedToken = window.localStorage.getItem(TOKEN_KEY);
      if (!storedToken) {
        if (active) {
          setUser(null);
          setToken(null);
          setLoading(false);
        }
        return;
      }

      try {
        const response = await fetch(`${API_BASE}/api/auth/me`, {
          headers: {
            Authorization: `Bearer ${storedToken}`,
          },
        });

        if (!response.ok) {
          throw new Error("Session invalid");
        }

        const data = await response.json();
        if (active) {
          setUser(data.user);
          setToken(storedToken);
        }
      } catch {
        if (active) {
          window.localStorage.removeItem(TOKEN_KEY);
          setUser(null);
          setToken(null);
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    checkAuth();

    return () => {
      active = false;
    };
  }, []);

  async function login(email, password) {
    try {
      const response = await fetch(`${API_BASE}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();
      if (!response.ok) {
        return { success: false, error: data.error || "Login failed." };
      }

      window.localStorage.setItem(TOKEN_KEY, data.token);
      setToken(data.token);
      setUser(data.user);
      return { success: true, user: data.user };
    } catch {
      return {
        success: false,
        error: "Unable to connect to the authentication server. Please check your backend.",
      };
    }
  }

  async function register(name, email, password) {
    try {
      const response = await fetch(`${API_BASE}/api/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, password }),
      });

      const data = await response.json();
      if (!response.ok) {
        return { success: false, error: data.error || "Registration failed." };
      }

      window.localStorage.setItem(TOKEN_KEY, data.token);
      setToken(data.token);
      setUser(data.user);
      return { success: true, user: data.user };
    } catch {
      return {
        success: false,
        error: "Unable to connect to the authentication server. Please check your backend.",
      };
    }
  }

  async function logout() {
    if (token) {
      try {
        await fetch(`${API_BASE}/api/auth/logout`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });
      } catch {
        // Even if network fails, proceed with client logout
      }
    }

    window.localStorage.removeItem(TOKEN_KEY);
    setUser(null);
    setToken(null);
  }

  async function updateProfile(profileData) {
    if (!token) {
      return { success: false, error: "Authentication required to update profile." };
    }

    try {
      const response = await fetch(`${API_BASE}/api/user/profile`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(profileData),
      });

      const data = await response.json();
      if (!response.ok) {
        return { success: false, error: data.error || "Failed to update profile." };
      }

      setUser(data.profile);
      return { success: true, profile: data.profile, message: data.message };
    } catch {
      return {
        success: false,
        error: "Unable to reach server. Please check your connection.",
      };
    }
  }

  async function refreshProfile() {
    if (!token) return null;
    try {
      const response = await fetch(`${API_BASE}/api/user/profile`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.ok) {
        const data = await response.json();
        setUser(data.profile);
        return data.profile;
      }
    } catch {
      // Ignore
    }
    return null;
  }

  // Quick helper for demo testing
  async function demoLogin() {
    return login("demo@cocode.dev", "password123");
  }

  const value = {
    user,
    token,
    loading,
    isAuthenticated: Boolean(user && token),
    login,
    register,
    logout,
    updateProfile,
    refreshProfile,
    demoLogin,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
