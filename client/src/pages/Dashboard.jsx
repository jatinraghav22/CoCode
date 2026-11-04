import React, { useState, useEffect, useMemo, useRef, useCallback } from "react";
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
  RefreshCw,
  AlertCircle,
} from "lucide-react";
import Navbar from "../components/Navbar.jsx";
import { useAuth } from "../AuthContext.jsx";
import "./Dashboard.css";

const API_BASE = (import.meta.env.VITE_API_URL || "http://localhost:5000").replace(/\/+$/, "");

export default function Dashboard() {
  const { user, token } = useAuth();
  const navigate = useNavigate();

  const [dashboardData, setDashboardData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [actionLoading, setActionLoading] = useState(false);

  const [searchQuery, setSearchQuery] = useState("");
  const [newProjectModalOpen, setNewProjectModalOpen] = useState(false);
  const [activeProjectMenu, setActiveProjectMenu] = useState(null);

  // New project form state
  const [newProjName, setNewProjName] = useState("");
  const [newProjLang, setNewProjLang] = useState("JavaScript");
  const [newProjDesc, setNewProjDesc] = useState("");

  const menuRef = useRef(null);

  // Fetch live dashboard statistics from database
  const fetchDashboard = useCallback(async () => {
    if (!token) {
      setLoading(false);
      return;
    }

    try {
      const response = await fetch(`${API_BASE}/api/dashboard`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to load dashboard data (status ${response.status})`);
      }

      const data = await response.json();
      setDashboardData(data);
      setError(null);
    } catch (err) {
      console.error("Dashboard fetch error:", err);
      setError(err.message || "Failed to load dashboard data.");
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    fetchDashboard();
  }, [fetchDashboard]);

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

  const projects = dashboardData?.recentProjects || [];

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

  // Create Project via backend API
  async function handleCreateProject(e) {
    e.preventDefault();
    if (!newProjName.trim() || !token) return;

    setActionLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/projects`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          name: newProjName.trim(),
          language: newProjLang,
          description: newProjDesc.trim(),
        }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || "Failed to create project");
      }

      setNewProjName("");
      setNewProjDesc("");
      setNewProjectModalOpen(false);
      await fetchDashboard();
    } catch (err) {
      alert(err.message || "Failed to create project.");
    } finally {
      setActionLoading(false);
    }
  }

  // Delete Project via backend API
  async function handleDeleteProject(id) {
    if (!token) return;
    setActionLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/projects/${id}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!res.ok) {
        throw new Error("Failed to delete project.");
      }

      setActiveProjectMenu(null);
      await fetchDashboard();
    } catch (err) {
      alert(err.message || "Failed to delete project.");
    } finally {
      setActionLoading(false);
    }
  }

  // Duplicate Project via backend API
  async function handleDuplicateProject(proj) {
    if (!token) return;
    setActionLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/projects`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          name: `${proj.name} (Copy)`,
          language: proj.language,
          description: proj.description || "",
        }),
      });

      if (!res.ok) {
        throw new Error("Failed to duplicate project.");
      }

      setActiveProjectMenu(null);
      await fetchDashboard();
    } catch (err) {
      alert(err.message || "Failed to duplicate project.");
    } finally {
      setActionLoading(false);
    }
  }

  function handleOpenProject(proj) {
    navigate(`/editor?projectId=${proj.id}&project=${encodeURIComponent(proj.name)}&lang=${encodeURIComponent(proj.language)}`);
  }

  // Real user greeting
  const actualName = user?.name || dashboardData?.user?.name || "Developer";
  const firstName = actualName.trim().split(" ")[0] || "Developer";

  // Real stats
  const stats = dashboardData?.stats || {
    totalProjects: 0,
    activeRooms: 0,
    todayActivityMinutes: 0,
    languagesUsedCount: 0,
  };

  // Format today's activity string
  const formattedTodayActivity = useMemo(() => {
    const mins = stats.todayActivityMinutes || 0;
    if (mins === 0) return "0 minutes";
    if (mins < 60) return `${mins}m`;
    const hours = Math.floor(mins / 60);
    const remMins = mins % 60;
    return remMins > 0 ? `${hours}h ${remMins}m` : `${hours}h`;
  }, [stats.todayActivityMinutes]);

  const popularLanguages = dashboardData?.popularLanguages || [];

  return (
    <div className="dashboard-page-wrapper">
      {/* Top Navigation Bar with Branding, Search, Notifications, Theme Toggle, Profile Dropdown */}
      <Navbar onSearchChange={setSearchQuery} searchValue={searchQuery} />

      <main className="dashboard-main-content">
        <div className="dashboard-container">
          {/* Error Banner */}
          {error && (
            <div className="dashboard-error-banner glass-panel">
              <div className="error-banner-content">
                <AlertCircle size={20} className="text-rose" />
                <span>{error}</span>
              </div>
              <button
                type="button"
                className="btn-retry"
                onClick={() => {
                  setLoading(true);
                  fetchDashboard();
                }}
              >
                <RefreshCw size={14} />
                <span>Retry</span>
              </button>
            </div>
          )}

          {/* =================================================================
              1. WELCOME HERO SECTION
              ================================================================= */}
          <section className="dashboard-welcome-section glass-panel">
            <div className="welcome-left-column">
              <div className="welcome-text-wrap">
                <h1 className="welcome-greeting">
                  {loading ? (
                    <span className="greeting-skeleton" />
                  ) : (
                    `Welcome back, ${firstName}! 👋`
                  )}
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
                    <strong className="stat-value">
                      {loading ? "..." : stats.totalProjects}
                    </strong>
                  </div>
                </div>

                {/* Active Rooms */}
                <div className="stat-card glass-panel stat-rooms">
                  <div className="stat-icon-box box-purple">
                    <UsersRound size={20} />
                  </div>
                  <div className="stat-info">
                    <span className="stat-label">Active Rooms</span>
                    <strong className="stat-value">
                      {loading ? "..." : stats.activeRooms}
                    </strong>
                  </div>
                </div>

                {/* Today's Activity */}
                <div className="stat-card glass-panel stat-activity">
                  <div className="stat-icon-box box-emerald">
                    <Clock size={20} />
                  </div>
                  <div className="stat-info">
                    <span className="stat-label">Today's Activity</span>
                    <strong className="stat-value">
                      {loading ? "..." : formattedTodayActivity}
                    </strong>
                  </div>
                </div>

                {/* Languages Used */}
                <div className="stat-card glass-panel stat-languages">
                  <div className="stat-icon-box box-violet">
                    <Code2 size={20} />
                  </div>
                  <div className="stat-info">
                    <span className="stat-label">Languages Used</span>
                    <strong className="stat-value">
                      {loading ? "..." : stats.languagesUsedCount}
                    </strong>
                  </div>
                </div>
              </div>
            </div>

            {/* Glowing 3D / Isometric Hero Laptop Graphic */}
            <div className="welcome-hero-graphic" aria-hidden="true">
              <div className="floating-laptop-stage">
                <div className="hero-glow-sphere cyan-glow" />
                <div className="hero-glow-sphere violet-glow" />

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
                  <Plus size={14} />
                  <span>New</span>
                </button>
              </div>

              <div className="projects-list-wrap">
                {loading ? (
                  <div className="dashboard-skeleton-list">
                    <div className="skeleton-project-row" />
                    <div className="skeleton-project-row" />
                    <div className="skeleton-project-row" />
                  </div>
                ) : filteredProjects.length === 0 ? (
                  <div className="empty-projects-state">
                    <div className="empty-icon-wrap">
                      <FolderGit2 size={36} className="text-muted-cyan" />
                    </div>
                    <strong className="empty-title">No projects yet</strong>
                    <p className="empty-desc">
                      No projects yet. Start your first coding project!
                    </p>
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
                          disabled={actionLoading}
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
                              disabled={actionLoading}
                            >
                              <Copy size={14} />
                              <span>Duplicate</span>
                            </button>
                            <button
                              type="button"
                              className="menu-option-item delete-option"
                              onClick={() => handleDeleteProject(project.id)}
                              disabled={actionLoading}
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
                  <span>Open Compiler</span>
                  <ArrowRight size={14} />
                </Link>
              </div>

              <div className="languages-breakdown-list">
                {loading ? (
                  <div className="dashboard-skeleton-list">
                    <div className="skeleton-lang-row" />
                    <div className="skeleton-lang-row" />
                    <div className="skeleton-lang-row" />
                  </div>
                ) : popularLanguages.length === 0 ? (
                  <div className="empty-languages-state">
                    <div className="empty-icon-wrap">
                      <Code2 size={36} className="text-muted-purple" />
                    </div>
                    <strong className="empty-title">No language activity yet</strong>
                    <p className="empty-desc">
                      Start coding in the compiler or create projects to see your programming language statistics!
                    </p>
                    <Link to="/compiler" className="btn-start-coding">
                      <Terminal size={14} />
                      <span>Start Coding</span>
                    </Link>
                  </div>
                ) : (
                  popularLanguages.map((item) => (
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
                  ))
                )}
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
                  <option value="JavaScript">JavaScript</option>
                  <option value="Python">Python</option>
                  <option value="C++">C++</option>
                  <option value="C">C</option>
                  <option value="Java">Java</option>
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
                <button
                  type="submit"
                  className="btn-modal-create"
                  disabled={actionLoading}
                >
                  {actionLoading ? "Creating..." : "Create Project"}
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
