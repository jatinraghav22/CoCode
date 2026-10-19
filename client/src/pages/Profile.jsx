import React, { useMemo } from "react";
import { Link } from "react-router-dom";
import {
  ArrowLeft,
  Edit3,
  Calendar,
  FolderGit2,
  UsersRound,
  ShieldCheck,
  Mail,
  AtSign,
  Globe,
  ExternalLink,
} from "lucide-react";
import Navbar from "../components/Navbar.jsx";
import { useAuth } from "../AuthContext.jsx";
import "./Profile.css";

function GithubIcon(props) {
  return (
    <svg
      width={props.size || 16}
      height={props.size || 16}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <path d="M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 0 0-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0 0 20 4.77 5.07 5.07 0 0 0 19.91 1S18.73.65 16 2.48a13.38 13.38 0 0 0-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 0 0 5 4.77a5.44 5.44 0 0 0-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 0 0 9 18.13V22" />
    </svg>
  );
}

function LinkedinIcon(props) {
  return (
    <svg
      width={props.size || 16}
      height={props.size || 16}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z" />
      <rect x="2" y="9" width="4" height="12" />
      <circle cx="4" cy="4" r="2" />
    </svg>
  );
}

const PROJECTS_STORAGE_KEY = "cocode-dashboard-projects-v1";

function getProjectsCount() {
  if (typeof window === "undefined") return 3;
  try {
    const raw = window.localStorage.getItem(PROJECTS_STORAGE_KEY);
    if (!raw) return 3;
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.length : 3;
  } catch {
    return 3;
  }
}

export default function Profile() {
  const { user } = useAuth();

  const projectCount = useMemo(() => getProjectsCount(), []);

  const defaultAvatar =
    user?.avatarUrl ||
    "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=400&q=80";

  const memberSince = user?.memberSince || "Oct 2025";
  const role = user?.role || "User";
  const joinedRoomsCount = 1;

  const skillsList = Array.isArray(user?.skills) && user.skills.length > 0
    ? user.skills
    : ["C++", "Python", "JavaScript", "HTML", "CSS", "React.js", "Node.js", "MongoDB", "Git/GitHub"];

  const socialLinks = user?.socialLinks || {
    github: "jatinraghav22",
    linkedin: "jatin-raghav-a9a060357",
    portfolio: "https://jatinraghav.vercel.app/",
  };

  const githubUrl = socialLinks.github
    ? (socialLinks.github.startsWith("http")
        ? socialLinks.github
        : `https://github.com/${socialLinks.github.replace(/^@/, "")}`)
    : "";

  const linkedinUrl = socialLinks.linkedin
    ? (socialLinks.linkedin.startsWith("http")
        ? socialLinks.linkedin
        : `https://linkedin.com/in/${socialLinks.linkedin.replace(/^@/, "")}`)
    : "";

  const portfolioUrl = socialLinks.portfolio
    ? (socialLinks.portfolio.startsWith("http")
        ? socialLinks.portfolio
        : `https://${socialLinks.portfolio}`)
    : "";

  return (
    <div className="profile-page-wrapper">
      {/* Consistent Top Navbar across Dashboard, Profile, Settings */}
      <Navbar />

      <main className="profile-page-content">
        <div className="profile-container">
          {/* Back Navigation Button */}
          <div className="profile-breadcrumbs">
            <Link to="/dashboard" className="back-to-dashboard-btn">
              <ArrowLeft size={16} />
              <span>Back to Dashboard</span>
            </Link>
          </div>

          {/* Page Heading */}
          <header className="profile-heading-section">
            <h1 className="profile-title">User Profile</h1>
            <p className="profile-subtitle">View and manage your account information.</p>
          </header>

          {/* Profile Hero Card */}
          <section className="profile-hero-card glass-panel">
            <div className="hero-avatar-wrap">
              <div className="hero-avatar-box">
                {defaultAvatar ? (
                  <img
                    src={defaultAvatar}
                    alt={user?.name || "Profile"}
                    className="hero-avatar-img"
                    onError={(e) => {
                      e.target.style.display = "none";
                    }}
                  />
                ) : null}
                <span className="hero-avatar-fallback">
                  {(user?.name || "Jatin Raghav").slice(0, 1)}
                </span>
                <span className="hero-avatar-status" title="Status: Active" />
              </div>

              <div className="hero-user-details">
                <div className="hero-name-row">
                  <h2 className="hero-user-name">{user?.name || "Jatin Raghav"}</h2>
                  <span className="hero-status-pill">
                    <span className="status-glow-dot" />
                    Active
                  </span>
                </div>

                <div className="hero-contact-row">
                  <div className="hero-meta-item">
                    <Mail size={14} className="meta-icon" />
                    <span>{user?.email || "jatinraghav22@gmail.com"}</span>
                  </div>
                  <div className="hero-meta-item">
                    <AtSign size={14} className="meta-icon" />
                    <span>@{user?.username || "jatin-raghav"}</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="hero-actions-wrap">
              <Link to="/settings/profile" className="btn-edit-profile">
                <Edit3 size={15} />
                <span>Edit Profile</span>
              </Link>
            </div>
          </section>

          {/* Stats Summary Row (4 metrics) */}
          <section className="profile-stats-grid">
            <div className="profile-stat-card glass-panel stat-yellow">
              <div className="stat-icon-wrap bg-yellow">
                <Calendar size={18} />
              </div>
              <div className="stat-text-wrap">
                <span className="stat-label">Member Since</span>
                <strong className="stat-value">{memberSince}</strong>
              </div>
            </div>

            <div className="profile-stat-card glass-panel stat-blue">
              <div className="stat-icon-wrap bg-blue">
                <FolderGit2 size={18} />
              </div>
              <div className="stat-text-wrap">
                <span className="stat-label">Total Projects</span>
                <strong className="stat-value">{projectCount}</strong>
              </div>
            </div>

            <div className="profile-stat-card glass-panel stat-purple">
              <div className="stat-icon-wrap bg-purple">
                <UsersRound size={18} />
              </div>
              <div className="stat-text-wrap">
                <span className="stat-label">Joined Rooms</span>
                <strong className="stat-value">{joinedRoomsCount}</strong>
              </div>
            </div>

            <div className="profile-stat-card glass-panel stat-violet">
              <div className="stat-icon-wrap bg-violet">
                <ShieldCheck size={18} />
              </div>
              <div className="stat-text-wrap">
                <span className="stat-label">Role</span>
                <strong className="stat-value">{role}</strong>
              </div>
            </div>
          </section>

          {/* Detailed Info Grid: Personal Information vs Skills & Socials */}
          <div className="profile-details-grid">
            {/* Left Column: Personal Information */}
            <section className="profile-detail-card glass-panel">
              <div className="card-header-row">
                <h3 className="detail-card-title">Personal Information</h3>
              </div>

              <div className="info-fields-list">
                <div className="info-field-row">
                  <span className="field-label">Full Name</span>
                  <strong className="field-value">{user?.name || "Jatin Raghav"}</strong>
                </div>

                <div className="info-field-row">
                  <span className="field-label">Email Address</span>
                  <strong className="field-value">{user?.email || "jatinraghav22@gmail.com"}</strong>
                </div>

                <div className="info-field-row">
                  <span className="field-label">Username</span>
                  <strong className="field-value">@{user?.username || "jatin-raghav"}</strong>
                </div>

                <div className="info-field-row">
                  <span className="field-label">Phone Number</span>
                  {user?.phone ? (
                    <strong className="field-value">{user.phone}</strong>
                  ) : (
                    <span className="empty-field-state">Not provided</span>
                  )}
                </div>

                <div className="info-field-row">
                  <span className="field-label">Location</span>
                  {user?.location ? (
                    <strong className="field-value">{user.location}</strong>
                  ) : (
                    <span className="empty-field-state">Not specified</span>
                  )}
                </div>

                <div className="info-field-row bio-field-row">
                  <span className="field-label">Bio</span>
                  {user?.bio ? (
                    <p className="bio-field-value">{user.bio}</p>
                  ) : (
                    <span className="empty-field-state">No bio provided yet.</span>
                  )}
                </div>
              </div>
            </section>

            {/* Right Column: Skills & Social Links */}
            <div className="profile-side-column">
              {/* Skills & Technologies */}
              <section className="profile-detail-card glass-panel">
                <div className="card-header-row">
                  <h3 className="detail-card-title">Skills & Technologies</h3>
                </div>

                {skillsList && skillsList.length > 0 ? (
                  <div className="skills-pill-wrap">
                    {skillsList.map((skill) => (
                      <span key={skill} className="skill-pill-tag">
                        {skill}
                      </span>
                    ))}
                  </div>
                ) : (
                  <div className="empty-skills-box">
                    <p>No skills specified yet.</p>
                    <Link to="/settings/profile" className="empty-action-link">
                      Add skills in Edit Profile
                    </Link>
                  </div>
                )}
              </section>

              {/* Social Links */}
              <section className="profile-detail-card glass-panel">
                <div className="card-header-row">
                  <h3 className="detail-card-title">Social Links</h3>
                </div>

                <div className="social-links-list">
                  {/* GitHub */}
                  <div className="social-link-item">
                    <div className="social-icon-box github-box">
                      <GithubIcon size={16} />
                    </div>
                    <div className="social-item-content">
                      <span className="social-service-name">GitHub</span>
                      {githubUrl ? (
                        <a
                          href={githubUrl}
                          target="_blank"
                          rel="noreferrer noopener"
                          className="social-url-link"
                        >
                          <span>{socialLinks.github}</span>
                          <ExternalLink size={12} />
                        </a>
                      ) : (
                        <span className="empty-social-state">Not connected</span>
                      )}
                    </div>
                  </div>

                  {/* LinkedIn */}
                  <div className="social-link-item">
                    <div className="social-icon-box linkedin-box">
                      <LinkedinIcon size={16} />
                    </div>
                    <div className="social-item-content">
                      <span className="social-service-name">LinkedIn</span>
                      {linkedinUrl ? (
                        <a
                          href={linkedinUrl}
                          target="_blank"
                          rel="noreferrer noopener"
                          className="social-url-link"
                        >
                          <span>{socialLinks.linkedin}</span>
                          <ExternalLink size={12} />
                        </a>
                      ) : (
                        <span className="empty-social-state">Not connected</span>
                      )}
                    </div>
                  </div>

                  {/* Portfolio */}
                  <div className="social-link-item">
                    <div className="social-icon-box portfolio-box">
                      <Globe size={16} />
                    </div>
                    <div className="social-item-content">
                      <span className="social-service-name">Portfolio</span>
                      {portfolioUrl ? (
                        <a
                          href={portfolioUrl}
                          target="_blank"
                          rel="noreferrer noopener"
                          className="social-url-link portfolio-link"
                        >
                          <span className="truncate-url">{socialLinks.portfolio}</span>
                          <ExternalLink size={12} />
                        </a>
                      ) : (
                        <span className="empty-social-state">Not provided</span>
                      )}
                    </div>
                  </div>
                </div>
              </section>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
