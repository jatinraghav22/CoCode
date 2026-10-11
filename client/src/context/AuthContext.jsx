import React, { createContext, useContext, useState, useEffect } from 'react';
import api from '../services/api';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(() => localStorage.getItem('cocode_token'));
  const [loading, setLoading] = useState(true);

  // Check current auth status on initial load
  useEffect(() => {
    const fetchCurrentUser = async () => {
      const storedToken = localStorage.getItem('cocode_token');
      if (!storedToken) {
        setLoading(false);
        return;
      }

      try {
        const response = await api.get('/auth/me');
        if (response.data.success) {
          setUser(response.data.data.user);
          localStorage.setItem('cocode_user', JSON.stringify(response.data.data.user));
        }
      } catch (err) {
        console.error('Session validation error:', err);
        localStorage.removeItem('cocode_token');
        localStorage.removeItem('cocode_user');
        setToken(null);
        setUser(null);
      } finally {
        setLoading(false);
      }
    };

    fetchCurrentUser();
  }, [token]);

  const login = async (identifier, password) => {
    const res = await api.post('/auth/login', { identifier, password });
    if (res.data.success) {
      const { user, token } = res.data.data;
      localStorage.setItem('cocode_token', token);
      localStorage.setItem('cocode_user', JSON.stringify(user));
      setToken(token);
      setUser(user);
    }
    return res.data;
  };

  const register = async (name, username, email, password) => {
    const res = await api.post('/auth/register', { name, username, email, password });
    if (res.data.success) {
      const { user, token } = res.data.data;
      localStorage.setItem('cocode_token', token);
      localStorage.setItem('cocode_user', JSON.stringify(user));
      setToken(token);
      setUser(user);
    }
    return res.data;
  };

  const logout = () => {
    localStorage.removeItem('cocode_token');
    localStorage.removeItem('cocode_user');
    setToken(null);
    setUser(null);
  };

  const updateUser = (updated) => {
    setUser((prev) => ({ ...prev, ...updated }));
    localStorage.setItem('cocode_user', JSON.stringify({ ...user, ...updated }));
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isAuthenticated: Boolean(user),
        loading,
        login,
        register,
        logout,
        updateUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
