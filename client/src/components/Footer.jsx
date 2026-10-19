import React from "react";
import { Link } from "react-router-dom";
import { Code2, Heart } from "lucide-react";
import "./Footer.css";

function GithubIcon({ size = 16 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 0 0-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0 0 20 4.77 5.07 5.07 0 0 0 19.91 1S18.73.65 16 2.48a13.38 13.38 0 0 0-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 0 0 5 4.77a5.44 5.44 0 0 0-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 0 0 9 18.13V22" />
    </svg>
  );
}

export default function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="site-footer">
      <div className="footer-container">
        <div className="footer-top">
          {/* Brand Info */}
          <div className="footer-brand-col">
            <Link to="/" className="footer-brand" aria-label="CoCode Home">
              <div className="brand-icon-box" style={{ width: 32, height: 32 }}>
                <Code2 size={18} strokeWidth={2.5} />
              </div>
              <span className="brand-title">
                Co<span>Code</span>
              </span>
            </Link>
            <p className="footer-brand-tagline">
              The modern browser-based developer platform for coding, real-time collaboration, and building without friction.
            </p>
            <a
              href="https://github.com/jatinraghav22/CoCode"
              target="_blank"
              rel="noopener noreferrer"
              className="footer-repo-link"
            >
              <GithubIcon size={16} />
              <span>jatinraghav22/CoCode</span>
            </a>
          </div>

          {/* Product Links */}
          <div className="footer-col">
            <h4>Product</h4>
            <ul>
              <li>
                <Link to="/compiler">Online Compiler</Link>
              </li>
              <li>
                <Link to="/rooms/create">Collaboration Rooms</Link>
              </li>
              <li>
                <Link to="/rooms/join">Join Room</Link>
              </li>
              <li>
                <Link to="/dashboard">Dashboard</Link>
              </li>
            </ul>
          </div>

          {/* Languages Supported */}
          <div className="footer-col">
            <h4>Languages</h4>
            <ul>
              <li>
                <Link to="/compiler">Python 3</Link>
              </li>
              <li>
                <Link to="/compiler">JavaScript (Node)</Link>
              </li>
              <li>
                <Link to="/compiler">C++ (GCC)</Link>
              </li>
            </ul>
          </div>

          {/* Account & Resources */}
          <div className="footer-col">
            <h4>Platform</h4>
            <ul>
              <li>
                <Link to="/login">Sign In</Link>
              </li>
              <li>
                <Link to="/signup">Create Account</Link>
              </li>
              <li>
                <Link to="/settings">Preferences</Link>
              </li>
            </ul>
          </div>
        </div>

        {/* Footer Bottom */}
        <div className="footer-bottom">
          <p>© {currentYear} CoCode — The Ultimate Developer Platform. All rights reserved.</p>
          <p>
            Engineered with <Heart size={14} className="footer-heart" /> for developers worldwide.
          </p>
        </div>
      </div>
    </footer>
  );
}
