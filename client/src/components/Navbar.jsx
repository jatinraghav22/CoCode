import React, { useState, useEffect, useRef } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  Code2,
  Search,
  Bell,
  Moon,
  Sun,
  ChevronDown,
  User,
  Settings,
  LogOut,
  Menu,
  X,
  ArrowRight,
  Terminal,
  UsersRound,
} from "lucide-react";
import { useAuth } from "../AuthContext.jsx";
import { useTheme } from "../ThemeContext.jsx";
import "./Navbar.css";

const SAMPLE_NOTIFICATIONS = [
  {
    id: 1,
    title: "Welcome to CoCode!",
    desc: "Your cloud development workspace is ready.",
    time: "10m ago",
    unread: true,
  },
  {
    id: 2,
    title: "Collaboration Room Active",
    desc: "Room DEMO01 is open for pair programming.",
    time: "1h ago",
    unread: true,
  },
  {
    id: 3,
    title: "Compiler Updated",
    desc: "Python 3.12, Node 22, and GCC 14 runtimes are live.",
    time: "1d ago",
    unread: false,
  },
];

export default function Navbar({ onSearchChange, searchValue = "" }) {
  const { isAuthenticated, user, logout } = useAuth();
  const { theme, changeTheme } = useTheme();
  const location = useLocation();
  const navigate = useNavigate();

  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [notifications, setNotifications] = useState(SAMPLE_NOTIFICATIONS);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [localSearch, setLocalSearch] = useState(searchValue);
  const [searchFocused, setSearchFocused] = useState(false);

  const dropdownRef = useRef(null);
  const notificationsRef = useRef(null);
  const searchInputRef = useRef(null);

  const unreadCount = notifications.filter((n) => n.unread).length;

  // Sync prop changes
  useEffect(() => {
    setLocalSearch(searchValue);
  }, [searchValue]);

  // Close menus on route change
  useEffect(() => {
    setDropdownOpen(false);
    setNotificationsOpen(false);
    setMobileMenuOpen(false);
    setSearchFocused(false);
  }, [location.pathname]);

  // Click outside listener for dropdowns
  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setDropdownOpen(false);
      }
      if (
        notificationsRef.current &&
        !notificationsRef.current.contains(event.target)
      ) {
        setNotificationsOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Keyboard shortcut Ctrl+K / Cmd+K to focus search
  useEffect(() => {
    function handleKeyDown(event) {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        searchInputRef.current?.focus();
        setSearchFocused(true);
      } else if (event.key === "Escape") {
        setDropdownOpen(false);
        setNotificationsOpen(false);
        setSearchFocused(false);
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  async function handleSignOut() {
    setDropdownOpen(false);
    setMobileMenuOpen(false);
    await logout();
    navigate("/", { replace: true });
  }

  function handleSearchInput(e) {
    const val = e.target.value;
    setLocalSearch(val);
    if (onSearchChange) {
      onSearchChange(val);
    }
  }

  function handleSearchSubmit(e) {
    e.preventDefault();
    if (location.pathname !== "/dashboard") {
      navigate(`/dashboard?search=${encodeURIComponent(localSearch)}`);
    }
    setSearchFocused(false);
  }

  function toggleThemeMode() {
    if (theme === "arctic") {
      changeTheme("default");
    } else {
      changeTheme("arctic");
    }
  }

  function markAllNotificationsRead() {
    setNotifications((prev) => prev.map((n) => ({ ...n, unread: false })));
  }

  const defaultAvatar =
    user?.avatarUrl ||
    "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=400&q=80";

  // If NOT authenticated, render public guest navbar
  if (!isAuthenticated) {
    return (
      <header className="site-navbar">
        <div className="navbar-container">
          <Link to="/" className="navbar-brand" aria-label="CoCode Home">
            <div className="brand-icon-box">
              <span className="brand-icon-letter">C</span>
            </div>
            <span className="brand-title">CoCode</span>
          </Link>

          <nav className="navbar-links" aria-label="Main Navigation">
            <Link to="/" className={`nav-link ${location.pathname === "/" ? "active" : ""}`}>
              Home
            </Link>
            <a href="/#features" className="nav-link">
              Features
            </a>
            <Link to="/compiler" className="nav-link">
              Compiler
            </Link>
            <Link to="/rooms/join" className="nav-link">
              Rooms
            </Link>
            <a href="/#about" className="nav-link">
              About
            </a>
          </nav>

          <div className="navbar-actions">
            <button
              type="button"
              className="nav-icon-btn"
              onClick={toggleThemeMode}
              title="Toggle Theme"
              aria-label="Toggle theme"
            >
              {theme === "arctic" ? <Sun size={18} /> : <Moon size={18} />}
            </button>
            <Link to="/login" className="btn-nav-ghost">
              Log in
            </Link>
            <Link to="/signup" className="btn-nav-primary">
              <span>Get Started</span>
              <ArrowRight size={15} />
            </Link>
          </div>

          <button
            className="mobile-toggle"
            type="button"
            aria-label="Open menu"
            onClick={() => setMobileMenuOpen((p) => !p)}
          >
            {mobileMenuOpen ? <X size={22} /> : <Menu size={22} />}
          </button>
        </div>

        {mobileMenuOpen && (
          <div className="mobile-menu">
            <Link to="/" className="nav-link" onClick={() => setMobileMenuOpen(false)}>
              Home
            </Link>
            <Link to="/compiler" className="nav-link" onClick={() => setMobileMenuOpen(false)}>
              Online Compiler
            </Link>
            <Link to="/rooms/join" className="nav-link" onClick={() => setMobileMenuOpen(false)}>
              Collaboration Rooms
            </Link>
            <div className="mobile-menu-actions">
              <Link to="/login" className="btn-nav-ghost" onClick={() => setMobileMenuOpen(false)}>
                Log in
              </Link>
              <Link to="/signup" className="btn-nav-primary" onClick={() => setMobileMenuOpen(false)}>
                Get Started
              </Link>
            </div>
          </div>
        )}
      </header>
    );
  }

  // AUTHENTICATED TOP NAVIGATION BAR (Dashboard, Profile, Settings)
  return (
    <header className="site-navbar logged-in-navbar">
      <div className="navbar-container">
        {/* Brand Logo */}
        <Link to="/dashboard" className="navbar-brand" aria-label="CoCode Dashboard">
          <div className="brand-icon-box">
            <span className="brand-icon-letter">C</span>
          </div>
          <span className="brand-title">CoCode</span>
        </Link>

        {/* Global Search Bar */}
        <div className="nav-search-container">
          <form className="nav-search-form" onSubmit={handleSearchSubmit}>
            <Search size={16} className="nav-search-icon" />
            <input
              ref={searchInputRef}
              type="text"
              className="nav-search-input"
              placeholder="Search projects, rooms, or users..."
              value={localSearch}
              onChange={handleSearchInput}
              onFocus={() => setSearchFocused(true)}
              onBlur={() => setTimeout(() => setSearchFocused(false), 200)}
              aria-label="Search projects, rooms, or users"
            />
            <div className="nav-search-kbd" title="Press Ctrl+K to search">
              <span>⌘K</span>
            </div>
          </form>

          {/* Quick-switch Search Dropdown */}
          {searchFocused && localSearch.trim().length > 0 && (
            <div className="nav-search-dropdown glass-panel">
              <div className="search-category-title">Quick Actions & Shortcuts</div>
              <Link
                to="/compiler"
                className="search-result-item"
                onClick={() => setSearchFocused(false)}
              >
                <div className="result-icon-box compiler-bg">
                  <Terminal size={14} />
                </div>
                <div className="result-info">
                  <strong>Open Compiler</strong>
                  <span>Instant sandbox for Python, JS, C++</span>
                </div>
              </Link>
              <Link
                to="/rooms/create"
                className="search-result-item"
                onClick={() => setSearchFocused(false)}
              >
                <div className="result-icon-box rooms-bg">
                  <UsersRound size={14} />
                </div>
                <div className="result-info">
                  <strong>Create Collaboration Room</strong>
                  <span>Invite teammates with room code</span>
                </div>
              </Link>
              <Link
                to="/profile"
                className="search-result-item"
                onClick={() => setSearchFocused(false)}
              >
                <div className="result-icon-box profile-bg">
                  <User size={14} />
                </div>
                <div className="result-info">
                  <strong>View Profile ({user?.name || "Jatin"})</strong>
                  <span>Bio, skills, connected accounts</span>
                </div>
              </Link>
            </div>
          )}
        </div>

        {/* Right Actions: Notifications, Theme Toggle, Profile Avatar */}
        <div className="navbar-actions">
          {/* Notifications Dropdown */}
          <div className="nav-notifications-wrap" ref={notificationsRef}>
            <button
              type="button"
              className={`nav-icon-btn ${notificationsOpen ? "active" : ""}`}
              onClick={() => setNotificationsOpen((prev) => !prev)}
              aria-label="Notifications"
              aria-expanded={notificationsOpen}
              title="Notifications"
            >
              <Bell size={18} />
              {unreadCount > 0 && <span className="notification-badge-dot" />}
            </button>

            {notificationsOpen && (
              <div className="notifications-dropdown glass-panel">
                <div className="notifications-header">
                  <div>
                    <strong>Notifications</strong>
                    {unreadCount > 0 && (
                      <span className="unread-tag">{unreadCount} new</span>
                    )}
                  </div>
                  {unreadCount > 0 && (
                    <button
                      type="button"
                      className="mark-read-btn"
                      onClick={markAllNotificationsRead}
                    >
                      Mark all as read
                    </button>
                  )}
                </div>

                <div className="notifications-list">
                  {notifications.map((item) => (
                    <div
                      key={item.id}
                      className={`notification-item ${item.unread ? "unread" : ""}`}
                    >
                      <div className="notif-indicator" />
                      <div className="notif-content">
                        <div className="notif-title">{item.title}</div>
                        <div className="notif-desc">{item.desc}</div>
                        <div className="notif-time">{item.time}</div>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="notifications-footer">
                  <span className="notif-status-text">All notifications caught up</span>
                </div>
              </div>
            )}
          </div>

          {/* Theme Toggle */}
          <button
            type="button"
            className="nav-icon-btn theme-toggle-btn"
            onClick={toggleThemeMode}
            title={theme === "arctic" ? "Switch to Dark Mode" : "Switch to Arctic Mode"}
            aria-label="Toggle color theme"
          >
            {theme === "arctic" ? <Sun size={18} /> : <Moon size={18} />}
          </button>

          {/* User Profile Avatar Dropdown */}
          <div className="nav-profile-wrap" ref={dropdownRef}>
            <button
              type="button"
              className={`profile-pill-trigger ${dropdownOpen ? "active" : ""}`}
              onClick={() => setDropdownOpen((prev) => !prev)}
              aria-label="User menu"
              aria-expanded={dropdownOpen}
              id="user-menu-button"
            >
              <div className="avatar-img-box">
                {defaultAvatar ? (
                  <img
                    src={defaultAvatar}
                    alt={user?.name || "User Avatar"}
                    className="avatar-photo"
                    onError={(e) => {
                      e.target.style.display = "none";
                    }}
                  />
                ) : null}
                <span className="avatar-fallback">
                  {(user?.name || "Jatin Raghav").slice(0, 1)}
                </span>
                <span className="avatar-status-dot" />
              </div>
              <span className="profile-display-name">
                {user?.name || "Jatin Raghav"}
              </span>
              <ChevronDown
                size={14}
                className={`dropdown-chevron ${dropdownOpen ? "open" : ""}`}
              />
            </button>

            {/* Profile Menu Dropdown */}
            {dropdownOpen && (
              <div
                className="profile-dropdown-menu glass-panel"
                role="menu"
                aria-orientation="vertical"
                aria-labelledby="user-menu-button"
              >
                {/* Menu Header Preview */}
                <div className="dropdown-user-header">
                  <div className="dropdown-avatar-large">
                    <img
                      src={defaultAvatar}
                      alt={user?.name || "User"}
                      className="avatar-photo"
                      onError={(e) => {
                        e.target.style.display = "none";
                      }}
                    />
                    <span className="avatar-fallback">
                      {(user?.name || "Jatin Raghav").slice(0, 1)}
                    </span>
                  </div>
                  <div className="dropdown-user-info">
                    <div className="dropdown-user-name">
                      {user?.name || "Jatin Raghav"}
                    </div>
                    <div className="dropdown-user-email">
                      {user?.email || "jatinraghav22@gmail.com"}
                    </div>
                  </div>
                </div>

                <div className="dropdown-divider" />

                {/* Navigation Items */}
                <Link
                  to="/profile"
                  className="dropdown-item"
                  role="menuitem"
                  onClick={() => setDropdownOpen(false)}
                  id="menu-item-profile"
                >
                  <User size={16} className="item-icon" />
                  <div className="item-text">
                    <span>Profile</span>
                    <small>View personal details & stats</small>
                  </div>
                </Link>

                <Link
                  to="/settings"
                  className="dropdown-item"
                  role="menuitem"
                  onClick={() => setDropdownOpen(false)}
                  id="menu-item-settings"
                >
                  <Settings size={16} className="item-icon" />
                  <div className="item-text">
                    <span>Settings</span>
                    <small>Preferences & edit profile</small>
                  </div>
                </Link>

                <div className="dropdown-divider" />

                <button
                  type="button"
                  className="dropdown-item sign-out-item"
                  role="menuitem"
                  onClick={handleSignOut}
                  id="menu-item-signout"
                >
                  <LogOut size={16} className="item-icon sign-out-icon" />
                  <div className="item-text">
                    <span className="sign-out-text">Sign Out</span>
                  </div>
                </button>
              </div>
            )}
          </div>

          {/* Mobile Hamburger Button */}
          <button
            className="mobile-toggle"
            type="button"
            aria-label="Toggle mobile menu"
            onClick={() => setMobileMenuOpen((prev) => !prev)}
          >
            {mobileMenuOpen ? <X size={22} /> : <Menu size={22} />}
          </button>
        </div>
      </div>

      {/* Mobile Drawer Navigation (Matches screenshot mobile view!) */}
      {mobileMenuOpen && (
        <div className="mobile-menu logged-in-mobile-menu">
          {/* User info card */}
          <div className="mobile-user-card">
            <div className="avatar-img-box">
              <img
                src={defaultAvatar}
                alt={user?.name || "Avatar"}
                className="avatar-photo"
              />
              <span className="avatar-status-dot" />
            </div>
            <div className="mobile-user-details">
              <strong>{user?.name || "Jatin Raghav"}</strong>
              <span>{user?.email || "jatinraghav22@gmail.com"}</span>
            </div>
          </div>

          {/* Search inside mobile menu */}
          <form className="mobile-search-form" onSubmit={handleSearchSubmit}>
            <Search size={16} className="nav-search-icon" />
            <input
              type="text"
              className="nav-search-input"
              placeholder="Search projects, rooms..."
              value={localSearch}
              onChange={handleSearchInput}
            />
          </form>

          {/* Mobile Links */}
          <div className="mobile-nav-links">
            <Link
              to="/dashboard"
              className={`mobile-nav-item ${location.pathname === "/dashboard" ? "active" : ""}`}
              onClick={() => setMobileMenuOpen(false)}
            >
              <Terminal size={18} />
              <span>Dashboard</span>
            </Link>

            <Link
              to="/profile"
              className={`mobile-nav-item ${location.pathname === "/profile" ? "active" : ""}`}
              onClick={() => setMobileMenuOpen(false)}
            >
              <User size={18} />
              <span>Profile</span>
            </Link>

            <Link
              to="/settings"
              className={`mobile-nav-item ${location.pathname.startsWith("/settings") ? "active" : ""}`}
              onClick={() => setMobileMenuOpen(false)}
            >
              <Settings size={18} />
              <span>Settings</span>
            </Link>

            <Link
              to="/compiler"
              className="mobile-nav-item"
              onClick={() => setMobileMenuOpen(false)}
            >
              <Code2 size={18} />
              <span>Online Compiler</span>
            </Link>

            <Link
              to="/rooms/create"
              className="mobile-nav-item"
              onClick={() => setMobileMenuOpen(false)}
            >
              <UsersRound size={18} />
              <span>Collaboration Rooms</span>
            </Link>
          </div>

          <div className="mobile-divider" />

          {/* Sign Out Button in Mobile */}
          <button
            type="button"
            className="mobile-signout-btn"
            onClick={handleSignOut}
          >
            <LogOut size={18} />
            <span>Sign Out</span>
          </button>
        </div>
      )}
    </header>
  );
}
