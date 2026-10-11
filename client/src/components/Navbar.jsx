import React from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Code2, Terminal, Users, LayoutDashboard, LogOut, User as UserIcon, Sparkles } from 'lucide-react';

const Navbar = () => {
  const { user, isAuthenticated, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const isActive = (path) => location.pathname === path;

  return (
    <nav
      style={{
        height: '60px',
        backgroundColor: 'var(--bg-secondary)',
        borderBottom: '1px solid var(--border-color)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 24px',
        position: 'sticky',
        top: 0,
        zIndex: 50,
      }}
    >
      {/* Brand Logo */}
      <Link
        to="/"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          textDecoration: 'none',
          color: 'var(--text-primary)',
        }}
      >
        <div
          style={{
            width: '34px',
            height: '34px',
            borderRadius: 'var(--radius-md)',
            background: 'linear-gradient(135deg, #0284c7 0%, #38bdf8 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: 'var(--shadow-glow)',
          }}
        >
          <Code2 size={20} color="#fff" />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <span style={{ fontWeight: 800, fontSize: '1.15rem', letterSpacing: '-0.02em' }}>
            Co<span style={{ color: 'var(--accent-primary)' }}>Code</span>
          </span>
        </div>
      </Link>

      {/* Nav links */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        {/* Instant Standalone Compiler link - accessible to everyone! */}
        <Link
          to="/editor"
          className="btn btn-secondary btn-sm"
          style={{
            background: isActive('/editor') ? 'var(--bg-hover)' : 'transparent',
            borderColor: isActive('/editor') ? 'var(--accent-primary)' : 'var(--border-color)',
          }}
          title="Open interactive code editor immediately"
        >
          <Terminal size={15} className="text-sky-400" />
          <span>Compiler</span>
        </Link>

        {isAuthenticated && (
          <Link
            to="/dashboard"
            className="btn btn-secondary btn-sm"
            style={{
              background: isActive('/dashboard') ? 'var(--bg-hover)' : 'transparent',
              borderColor: isActive('/dashboard') ? 'var(--accent-primary)' : 'var(--border-color)',
            }}
          >
            <LayoutDashboard size={15} />
            <span>Dashboard</span>
          </Link>
        )}
      </div>

      {/* Auth Actions / User Pill */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        {isAuthenticated ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '4px 10px',
                borderRadius: 'var(--radius-full)',
                backgroundColor: 'var(--bg-card)',
                border: '1px solid var(--border-color)',
              }}
            >
              <img
                src={user?.avatar || `https://api.dicebear.com/7.x/identicon/svg?seed=${user?.username}`}
                alt={user?.name}
                style={{ width: '24px', height: '24px', borderRadius: '50%' }}
              />
              <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>{user?.name}</span>
            </div>
            <button
              onClick={handleLogout}
              className="btn btn-ghost btn-sm"
              title="Log out"
              style={{ color: 'var(--danger)' }}
            >
              <LogOut size={16} />
              <span className="hidden sm:inline">Logout</span>
            </button>
          </div>
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Link to="/login" className="btn btn-ghost btn-sm">
              Log In
            </Link>
            <Link to="/register" className="btn btn-primary btn-sm">
              Get Started
            </Link>
          </div>
        )}
      </div>
    </nav>
  );
};

export default Navbar;
