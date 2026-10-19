import React, { useState, useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import { Code2, Menu, X, ArrowRight, LayoutDashboard, LogOut } from "lucide-react";
import Button from "./Button.jsx";
import { useAuth } from "../AuthContext.jsx";
import "./Navbar.css";

export default function Navbar() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const location = useLocation();
  const { isAuthenticated, user, logout } = useAuth();

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 20);
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const closeMobile = () => setMobileOpen(false);

  const guestNavLinks = [
    { label: "Home", to: "/" },
    { label: "Features", to: "/#features" },
    { label: "Compiler", to: "/compiler" },
    { label: "Rooms", to: "/rooms/create" },
    { label: "About", to: "/#about" },
  ];

  const authNavLinks = [
    { label: "Dashboard", to: "/dashboard" },
    { label: "Compiler", to: "/compiler" },
    { label: "Rooms", to: "/rooms/create" },
    { label: "Settings", to: "/settings" },
  ];

  const currentNavLinks = isAuthenticated ? authNavLinks : guestNavLinks;

  return (
    <header className={`site-navbar ${scrolled ? "scrolled" : ""}`}>
      <div className="navbar-container">
        {/* Brand Logo */}
        <Link to="/" className="navbar-brand" aria-label="CoCode Home">
          <div className="brand-icon-box">
            <Code2 size={22} strokeWidth={2.5} />
          </div>
          <span className="brand-title">
            Co<span>Code</span>
          </span>
          <span className="brand-badge">Dev</span>
        </Link>

        {/* Desktop Navigation Links */}
        <nav className="navbar-links" aria-label="Main Navigation">
          {currentNavLinks.map((link) => {
            const isAnchor = link.to.includes("#");
            if (isAnchor) {
              return (
                <a key={link.label} href={link.to} className="nav-link">
                  {link.label}
                </a>
              );
            }
            return (
              <Link
                key={link.label}
                to={link.to}
                className={`nav-link ${location.pathname === link.to ? "active" : ""}`}
              >
                {link.label}
              </Link>
            );
          })}
        </nav>

        {/* Action Buttons */}
        <div className="navbar-actions">
          {isAuthenticated ? (
            <>
              <Button variant="secondary" size="sm" to="/dashboard" icon={LayoutDashboard}>
                {user?.name?.split(" ")[0] || "Dashboard"}
              </Button>
              <Button variant="ghost" size="sm" onClick={logout} icon={LogOut}>
                Sign out
              </Button>
            </>
          ) : (
            <>
              <Button variant="ghost" size="sm" to="/login">
                Log in
              </Button>
              <Button
                variant="primary"
                size="sm"
                to="/signup"
                iconRight={ArrowRight}
              >
                Get Started
              </Button>
            </>
          )}
        </div>

        {/* Mobile Hamburger Button */}
        <button
          className="mobile-toggle"
          type="button"
          aria-label={mobileOpen ? "Close menu" : "Open menu"}
          aria-expanded={mobileOpen}
          onClick={() => setMobileOpen((prev) => !prev)}
        >
          {mobileOpen ? <X size={22} /> : <Menu size={22} />}
        </button>
      </div>

      {/* Mobile Drawer */}
      {mobileOpen && (
        <div className="mobile-menu">
          {currentNavLinks.map((link) => {
            const isAnchor = link.to.includes("#");
            if (isAnchor) {
              return (
                <a
                  key={link.label}
                  href={link.to}
                  className="nav-link"
                  onClick={closeMobile}
                >
                  {link.label}
                </a>
              );
            }
            return (
              <Link
                key={link.label}
                to={link.to}
                className={`nav-link ${location.pathname === link.to ? "active" : ""}`}
                onClick={closeMobile}
              >
                {link.label}
              </Link>
            );
          })}
          <div className="mobile-menu-actions">
            {isAuthenticated ? (
              <>
                <Button variant="secondary" size="md" to="/dashboard" className="btn-full" onClick={closeMobile}>
                  Open Dashboard
                </Button>
                <Button variant="ghost" size="md" onClick={() => { logout(); closeMobile(); }} className="btn-full">
                  Sign out
                </Button>
              </>
            ) : (
              <>
                <Button variant="secondary" size="md" to="/login" className="btn-full" onClick={closeMobile}>
                  Log in
                </Button>
                <Button
                  variant="primary"
                  size="md"
                  to="/signup"
                  iconRight={ArrowRight}
                  className="btn-full"
                  onClick={closeMobile}
                >
                  Get Started Free
                </Button>
              </>
            )}
          </div>
        </div>
      )}
    </header>
  );
}
