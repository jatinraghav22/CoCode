import React, { useState, useEffect, useMemo, useRef } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  FolderGit2,
  UsersRound,
  Clock,
  Code2,
  Terminal,
  Plus,
  Hash,
  ArrowRight,
  MoreVertical,
  Laptop,
  X,
  FileCode,
  Trash2,
  Copy,
  FolderPlus,
} from "lucide-react";
import Navbar from "../components/Navbar.jsx";
import { useAuth } from "../AuthContext.jsx";
import "./Dashboard.css";

const PROJECTS_STORAGE_KEY = "cocode-dashboard-projects-v1";
const DAY_MS = 24 * 60 * 60 * 1000;

const DEFAULT_PROJECTS = [
  {
    id: "proj-1",
    name: "Calculator App",
    language: "Python",
    iconType: "calc",
    updatedText: "2 days ago",
    updatedAt: Date.now() - 2 * DAY_MS,
    description: "Scientific calculation module with CLI interface",
  },
  {
    id: "proj-2",
    name: "Weather App",
    language: "JavaScript",
    iconType: "weather",
    updatedText: "4 days ago",
    updatedAt: Date.now() - 4 * DAY_MS,
    description: "Forecast tracker with geolocation & OpenWeather integration",
  },
  {
    id: "proj-3",
    name: "Portfolio Website",
    language: "HTML",
    iconType: "web",
    updatedText: "5 days ago",
    updatedAt: Date.now() - 5 * DAY_MS,
    description: "Modern developer portfolio with responsive dark theme",
  },
];

const POPULAR_LANGUAGES = [
  { name: "Python", percentage: 32, color: "#38bdf8", icon: "🐍" },
  { name: "JavaScript", percentage: 26, color: "#facc15", icon: "⚡" },
  { name: "C++", percentage: 15, color: "#60a5fa", icon: "⚙️" },
  { name: "Java", percentage: 12, color: "#c084fc", icon: "☕" },
  { name: "Others", percentage: 15, color: "#94a3b8", icon: "📦" },
];

function readStoredProjects() {
  if (typeof window === "undefined") return DEFAULT_PROJECTS;
  try {
    const raw = window.localStorage.getItem(PROJECTS_STORAGE_KEY);
    if (!raw) {
      window.localStorage.setItem(PROJECTS_STORAGE_KEY, JSON.stringify(DEFAULT_PROJECTS));
      return DEFAULT_PROJECTS;
    }
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed) || parsed.length === 0) {
      window.localStorage.setItem(PROJECTS_STORAGE_KEY, JSON.stringify(DEFAULT_PROJECTS));
      return DEFAULT_PROJECTS;
    }
    return parsed;
  } catch {
    return DEFAULT_PROJECTS;
  }
}

export default function Dashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [projects, setProjects] = useState(readStoredProjects);
  const [searchQuery, setSearchQuery] = useState("");
  const [newProjectModalOpen, setNewProjectModalOpen] = useState(false);
  const [activeProjectMenu, setActiveProjectMenu] = useState(null);

  // New project form state
  const [newProjName, setNewProjName] = useState("");
  const [newProjLang, setNewProjLang] = useState("Python");
  const [newProjDesc, setNewProjDesc] = useState("");

  const menuRef = useRef(null);

  // Sync projects with localStorage
  useEffect(() => {
    try {
      window.localStorage.setItem(PROJECTS_STORAGE_KEY, JSON.stringify(projects));
    } catch {
      // Ignore quota errors
    }
  }, [projects]);

  // Close 3-dots menus when clicking outside
  useEffect(() => {
    function handleClickOutside(event) {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setActiveProjectMenu(null);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Filter projects by search query
  const filteredProjects = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return projects;
    return projects.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.language.toLowerCase().includes(q) ||
        (p.description && p.description.toLowerCase().includes(q))
    );
  }, [projects, searchQuery]);

  // Total unique languages used
  const languagesUsedCount = useMemo(() => {
    const langs = new Set(projects.map((p) => p.language));
    langs.add("Python");
    langs.add("JavaScript");
    langs.add("C++");
    langs.add("HTML");
    langs.add("CSS");
    return langs.size;
  }, [projects]);

  function handleCreateProject(e) {
    e.preventDefault();
    if (!newProjName.trim()) return;

    let icon = "code";
    if (newProjLang === "Python") icon = "calc";
    else if (newProjLang === "JavaScript") icon = "weather";
    else if (newProjLang === "HTML" || newProjLang === "CSS") icon = "web";

    const newProject = {
      id: `proj-${Date.now()}`,
      name: newProjName.trim(),
      language: newProjLang,
      iconType: icon,
      updatedText: "Just now",
      updatedAt: Date.now(),
      description: newProjDesc.trim() || `${newProjLang} coding project`,
    };

    setProjects((prev) => [newProject, ...prev]);
    setNewProjName("");
    setNewProjDesc("");
    setNewProjectModalOpen(false);
  }

  function handleDeleteProject(id) {
    setProjects((prev) => prev.filter((p) => p.id !== id));
    setActiveProjectMenu(null);
  }

  function handleDuplicateProject(proj) {
    const duplicate = {
      ...proj,
      id: `proj-${Date.now()}`,
      name: `${proj.name} (Copy)`,
      updatedText: "Just now",
      updatedAt: Date.now(),
    };
    setProjects((prev) => [duplicate, ...prev]);
    setActiveProjectMenu(null);
  }

  function handleOpenProject(proj) {
    navigate(`/compiler?project=${encodeURIComponent(proj.name)}&lang=${encodeURIComponent(proj.language)}`);
  }

  const firstName = user?.name ? user.name.split(" ")[0] : "Jatin";

  return (
    <div className="dashboard-page-wrapper">
      {/* Clean Top Navigation Bar with Branding, Global Search, Notifications, Theme Toggle, Profile Dropdown */}
      <Navbar onSearchChange={setSearchQuery} searchValue={searchQuery} />

      <main className="dashboard-main-content">
        <div className="dashboard-container">
          {/* =================================================================
              1. WELCOME HERO SECTION
              ================================================================= */}
          <section className="dashboard-welcome-section glass-panel">
            <div className="welcome-left-column">
              <div className="welcome-text-wrap">
                <h1 className="welcome-greeting">
                  Welcome back, {firstName}! 👋
                </h1>
                <p className="welcome-motivational">
                  Keep coding, keep growing. You're doing great!
                </p>
              </div>

              {/* Statistics Row (4 Cards) */}
              <div className="dashboard-stats-row">
                {/* Total Projects */}
                <div className="stat-card glass-panel stat-projects">
                  <div className="stat-icon-box box-blue">
                    <FolderGit2 size={20} />
                  </div>
                  <div className="stat-info">
                    <span className="stat-label">Total Projects</span>
                    <strong className="stat-value">{projects.length}</strong>
                  </div>
                </div>

                {/* Active Rooms */}
                <div className="stat-card glass-panel stat-rooms">
                  <div className="stat-icon-box box-purple">
                    <UsersRound size={20} />
                  </div>
                  <div className="stat-info">
                    <span className="stat-label">Active Rooms</span>
                    <strong className="stat-value">1</strong>
                  </div>
                </div>

                {/* Today's Activity */}
                <div className="stat-card glass-panel stat-activity">
                  <div className="stat-icon-box box-emerald">
                    <Clock size={20} />
                  </div>
                  <div className="stat-info">
                    <span className="stat-label">Today's Activity</span>
                    <strong className="stat-value">2h 24m</strong>
                  </div>
                </div>

                {/* Languages Used */}
                <div className="stat-card glass-panel stat-languages">
                  <div className="stat-icon-box box-violet">
                    <Code2 size={20} />
                  </div>
                  <div className="stat-info">
                    <span className="stat-label">Languages Used</span>
                    <strong className="stat-value">{languagesUsedCount}</strong>
                  </div>
                </div>
              </div>
            </div>

            {/* Glowing 3D / Isometric Hero Laptop Graphic */}
            <div className="welcome-hero-graphic" aria-hidden="true">
              <div className="floating-laptop-stage">
                {/* Ambient glow backgrounds */}
                <div className="hero-glow-sphere cyan-glow" />
                <div className="hero-glow-sphere violet-glow" />

                {/* Holographic Floating Code Badges */}
                <div className="hologram-chip chip-one">
                  <code>&lt; / &gt;</code>
                </div>
                <div className="hologram-chip chip-two">
                  <span>{`{ }`}</span>
                </div>
                <div className="hologram-chip chip-three">
                  <span className="chip-lang-badge">JS</span>
                </div>
                <div className="hologram-chip chip-four">
                  <span className="chip-lang-badge">Py</span>
                </div>

                {/* Isometric Laptop Graphic */}
                <div className="isometric-laptop">
                  <div className="laptop-screen">
                    <div className="screen-header">
                      <span className="screen-dot red" />
                      <span className="screen-dot yellow" />
                      <span className="screen-dot green" />
                    </div>
                    <div className="screen-code-lines">
                      <div className="code-line ln-1" />
                      <div className="code-line ln-2" />
                      <div className="code-line ln-3" />
                      <div className="code-line ln-4" />
                      <div className="code-line ln-5" />
                    </div>
                    <div className="screen-reflection" />
                  </div>
                  <div className="laptop-base">
                    <div className="laptop-keyboard" />
                    <div className="laptop-trackpad" />
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* =================================================================
              2. QUICK ACTIONS SECTION (4 Cards Grid)
              ================================================================= */}
          <section className="dashboard-section quick-actions-section">
            <h2 className="section-title-clean">Quick Actions</h2>

            <div className="quick-actions-grid">
              {/* Action 1: Open Compiler */}
              <Link to="/compiler" className="quick-action-card glass-panel action-compiler">
                <div className="action-icon-wrapper box-purple-grad">
                  <Terminal size={22} />
                </div>
                <div className="action-text-wrapper">
                  <h3 className="action-title">Open Compiler</h3>
                  <p className="action-desc">Start coding without login</p>
                </div>
              </Link>

              {/* Action 2: Create Room */}
              <Link to="/rooms/create" className="quick-action-card glass-panel action-room-create">
                <div className="action-icon-wrapper box-blue-grad">
                  <UsersRound size={22} />
                </div>
                <div className="action-text-wrapper">
                  <h3 className="action-title">Create Room</h3>
                  <p className="action-desc">Collaborate with others</p>
                </div>
              </Link>

              {/* Action 3: Join Room */}
              <Link to="/rooms/join" className="quick-action-card glass-panel action-room-join">
                <div className="action-icon-wrapper box-cyan-grad">
                  <Hash size={22} />
                </div>
                <div className="action-text-wrapper">
                  <h3 className="action-title">Join Room</h3>
                  <p className="action-desc">Enter room code</p>
                </div>
              </Link>

              {/* Action 4: New Project */}
              <button
                type="button"
                className="quick-action-card glass-panel action-new-project"
                onClick={() => setNewProjectModalOpen(true)}
              >
                <div className="action-icon-wrapper box-emerald-grad">
                  <Plus size={22} />
                </div>
                <div className="action-text-wrapper">
                  <h3 className="action-title">New Project</h3>
                  <p className="action-desc">Start building</p>
                </div>
              </button>
            </div>
          </section>

          {/* =================================================================
              3. TWO COLUMNS: RECENT PROJECTS vs POPULAR LANGUAGES
              ================================================================= */}
          <div className="dashboard-bottom-grid">
            {/* Left Column: Recent Projects */}
            <section className="dashboard-card-column glass-panel">
              <div className="card-header-bar">
                <h2 className="card-header-heading">Recent Projects</h2>
                <button
                  type="button"
                  className="card-header-link"
                  onClick={() => setNewProjectModalOpen(true)}
                >
                  <span>View all</span>
                  <ArrowRight size={14} />
                </button>
              </div>

              <div className="projects-list-wrap">
                {filteredProjects.length === 0 ? (
                  <div className="empty-projects-state">
                    <p>No projects match your search.</p>
                    <button
                      type="button"
                      className="btn-create-first"
                      onClick={() => setNewProjectModalOpen(true)}
                    >
                      <Plus size={14} />
                      <span>Create New Project</span>
                    </button>
                  </div>
                ) : (
                  filteredProjects.map((project) => (
                    <div key={project.id} className="project-list-row">
                      {/* Project Icon */}
                      <div className={`project-avatar-icon ${project.iconType}`}>
                        {project.iconType === "calc" && <UsersRound size={18} />}
                        {project.iconType === "weather" && <Laptop size={18} />}
                        {project.iconType === "web" && <FileCode size={18} />}
                        {!["calc", "weather", "web"].includes(project.iconType) && (
                          <Code2 size={18} />
                        )}
                      </div>

                      {/* Project Meta */}
                      <div className="project-meta-box">
                        <strong className="project-title">{project.name}</strong>
                        <span className="project-subtext">
                          {project.language} • {project.updatedText}
                        </span>
                      </div>

                      {/* Action: Open Button */}
                      <button
                        type="button"
                        className="btn-open-project"
                        onClick={() => handleOpenProject(project)}
                      >
                        Open
                      </button>

                      {/* 3-dots Menu Button */}
                      <div className="project-options-wrap" ref={activeProjectMenu === project.id ? menuRef : null}>
                        <button
                          type="button"
                          className="btn-project-dots"
                          onClick={() =>
                            setActiveProjectMenu(
                              activeProjectMenu === project.id ? null : project.id
                            )
                          }
                          aria-label="Project actions"
                        >
                          <MoreVertical size={16} />
                        </button>

                        {/* Dropdown Options */}
                        {activeProjectMenu === project.id && (
                          <div className="project-menu-dropdown glass-panel">
                            <button
                              type="button"
                              className="menu-option-item"
                              onClick={() => handleDuplicateProject(project)}
                            >
                              <Copy size={14} />
                              <span>Duplicate</span>
                            </button>
                            <button
                              type="button"
                              className="menu-option-item delete-option"
                              onClick={() => handleDeleteProject(project.id)}
                            >
                              <Trash2 size={14} />
                              <span>Remove</span>
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </section>

            {/* Right Column: Popular Languages */}
            <section className="dashboard-card-column glass-panel">
              <div className="card-header-bar">
                <h2 className="card-header-heading">Popular Languages</h2>
                <Link to="/compiler" className="card-header-link">
                  <span>View all</span>
                  <ArrowRight size={14} />
                </Link>
              </div>

              <div className="languages-breakdown-list">
                {POPULAR_LANGUAGES.map((item) => (
                  <div key={item.name} className="language-row-item">
                    <div className="language-info-left">
                      <span className="language-icon-emoji">{item.icon}</span>
                      <strong className="language-name">{item.name}</strong>
                    </div>

                    <div className="language-bar-track">
                      <div
                        className="language-bar-fill"
                        style={{
                          width: `${item.percentage}%`,
                          backgroundColor: item.color,
                        }}
                      />
                    </div>

                    <div className="language-percentage">{item.percentage}%</div>
                  </div>
                ))}
              </div>
            </section>
          </div>
        </div>
      </main>

      {/* =====================================================================
          NEW PROJECT MODAL
          ===================================================================== */}
      {newProjectModalOpen && (
        <div className="modal-backdrop" onClick={() => setNewProjectModalOpen(false)}>
          <div
            className="new-project-modal glass-panel"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-header-row">
              <div className="modal-title-with-icon">
                <FolderPlus size={20} className="text-violet" />
                <h3>Create New Project</h3>
              </div>
              <button
                type="button"
                className="modal-close-btn"
                onClick={() => setNewProjectModalOpen(false)}
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleCreateProject} className="modal-form">
              <div className="form-group">
                <label className="form-label">Project Name *</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="e.g. Markdown Parser"
                  value={newProjName}
                  onChange={(e) => setNewProjName(e.target.value)}
                  autoFocus
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">Programming Language</label>
                <select
                  className="form-input form-select"
                  value={newProjLang}
                  onChange={(e) => setNewProjLang(e.target.value)}
                >
                  <option value="Python">Python</option>
                  <option value="JavaScript">JavaScript</option>
                  <option value="C++">C++</option>
                  <option value="HTML">HTML / CSS</option>
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Description (optional)</label>
                <textarea
                  rows={2}
                  className="form-textarea"
                  placeholder="Brief description of your project workspace..."
                  value={newProjDesc}
                  onChange={(e) => setNewProjDesc(e.target.value)}
                />
              </div>

              <div className="modal-actions-row">
                <button type="submit" className="btn-modal-create">
                  Create Project
                </button>
                <button
                  type="button"
                  className="btn-modal-cancel"
                  onClick={() => setNewProjectModalOpen(false)}
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
