import React, { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  FolderGit2,
  FolderPlus,
  Plus,
  Search,
  MoreVertical,
  Edit3,
  Trash2,
  Copy,
  ExternalLink,
  Code2,
  FileCode,
  Laptop,
  UsersRound,
  AlertCircle,
  RefreshCw,
  X,
  Clock,
  Terminal,
} from "lucide-react";
import Navbar from "../components/Navbar.jsx";
import { useAuth } from "../AuthContext.jsx";
import { API_BASE } from "../config/api.js";
import "./Projects.css";

const LANG_OPTIONS = [
  { label: "All Languages", value: "all" },
  { label: "JavaScript", value: "javascript" },
  { label: "Python", value: "python" },
  { label: "C++", value: "cpp" },
  { label: "C", value: "c" },
  { label: "Java", value: "java" },
  { label: "HTML / CSS", value: "html" },
];

export default function Projects() {
  const { user, token } = useAuth();
  const navigate = useNavigate();

  const [projects, setProjects] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 12, total: 0, totalPages: 1 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [actionLoading, setActionLoading] = useState(false);

  const [searchQuery, setSearchQuery] = useState("");
  const [selectedLanguage, setSelectedLanguage] = useState("all");
  const [newProjectModalOpen, setNewProjectModalOpen] = useState(false);
  const [activeProjectMenu, setActiveProjectMenu] = useState(null);

  // Form state
  const [newProjName, setNewProjName] = useState("");
  const [newProjLang, setNewProjLang] = useState("javascript");
  const [newProjDesc, setNewProjDesc] = useState("");

  const menuRef = useRef(null);

  // Fetch projects from backend API
  const fetchProjects = useCallback(async (page = 1) => {
    if (!token) {
      setLoading(false);
      return;
    }

    try {
      const queryParams = new URLSearchParams({
        page: String(page),
        limit: "24",
      });
      if (searchQuery.trim()) {
        queryParams.set("search", searchQuery.trim());
      }

      const res = await fetch(`${API_BASE}/api/projects?${queryParams.toString()}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!res.ok) {
        throw new Error(`Failed to load projects (status ${res.status})`);
      }

      const data = await res.json();
      setProjects(data.projects || []);
      if (data.pagination) {
        setPagination(data.pagination);
      }
      setError(null);
    } catch (err) {
      console.error("Projects fetch error:", err);
      setError(err.message || "Failed to load projects.");
    } finally {
      setLoading(false);
    }
  }, [token, searchQuery]);

  useEffect(() => {
    fetchProjects();
  }, [fetchProjects]);

  // Close menus when clicking outside
  useEffect(() => {
    function handleClickOutside(event) {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setActiveProjectMenu(null);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Filter projects by language
  const filteredProjects = useMemo(() => {
    if (selectedLanguage === "all") return projects;
    return projects.filter(
      (p) => (p.defaultLanguage || p.language || "").toLowerCase() === selectedLanguage.toLowerCase()
    );
  }, [projects, selectedLanguage]);

  // Create Project handler
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
          defaultLanguage: newProjLang,
          language: newProjLang,
          description: newProjDesc.trim(),
        }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || errData.message || "Failed to create project");
      }

      const created = await res.json();
      const proj = created.project;

      setNewProjName("");
      setNewProjDesc("");
      setNewProjectModalOpen(false);
      // Navigate straight to the new project in Monaco editor
      navigate(`/editor?projectId=${proj.id}&project=${encodeURIComponent(proj.name)}&lang=${encodeURIComponent(proj.defaultLanguage || newProjLang)}`);
    } catch (err) {
      alert(err.message || "Failed to create project.");
    } finally {
      setActionLoading(false);
    }
  }

  // Delete Project handler
  async function handleDeleteProject(id, name) {
    if (!token) return;
    if (!window.confirm(`Are you sure you want to delete project "${name}"? This action cannot be undone.`)) {
      return;
    }

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
      await fetchProjects(pagination.page);
    } catch (err) {
      alert(err.message || "Failed to delete project.");
    } finally {
      setActionLoading(false);
    }
  }

  // Duplicate Project handler
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
          defaultLanguage: proj.defaultLanguage || proj.language,
          description: proj.description || "",
        }),
      });

      if (!res.ok) {
        throw new Error("Failed to duplicate project.");
      }

      setActiveProjectMenu(null);
      await fetchProjects(pagination.page);
    } catch (err) {
      alert(err.message || "Failed to duplicate project.");
    } finally {
      setActionLoading(false);
    }
  }

  // Rename Project handler
  async function handleRenameProject(proj) {
    if (!token) return;
    const newName = window.prompt("Enter new project name:", proj.name);
    if (!newName || !newName.trim() || newName.trim() === proj.name) return;
    setActionLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/projects/${proj.id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ name: newName.trim() }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.message || data.error || "Failed to rename project.");
      }

      setActiveProjectMenu(null);
      await fetchProjects(pagination.page);
    } catch (err) {
      alert(err.message || "Failed to rename project.");
    } finally {
      setActionLoading(false);
    }
  }

  function handleOpenProject(proj) {
    const lang = proj.defaultLanguage || proj.language || "javascript";
    navigate(`/editor?projectId=${proj.id}&project=${encodeURIComponent(proj.name)}&lang=${encodeURIComponent(lang)}`);
  }

  function getLangColor(lang) {
    const l = (lang || "").toLowerCase();
    if (l === "python") return "#38bdf8";
    if (l === "cpp" || l === "c++") return "#60a5fa";
    if (l === "c") return "#818cf8";
    if (l === "java") return "#c084fc";
    if (l === "html" || l === "css") return "#fb923c";
    return "#facc15"; // javascript
  }

  return (
    <div className="projects-page-wrapper">
      <Navbar onSearchChange={setSearchQuery} searchValue={searchQuery} />

      <main className="projects-main-content">
        <div className="projects-container">
          {/* Error Banner */}
          {error && (
            <div className="projects-error-banner glass-panel">
              <div className="error-banner-content">
                <AlertCircle size={20} className="text-rose" />
                <span>{error}</span>
              </div>
              <button
                type="button"
                className="btn-retry"
                onClick={() => {
                  setLoading(true);
                  fetchProjects();
                }}
              >
                <RefreshCw size={14} />
                <span>Retry</span>
              </button>
            </div>
          )}

          {/* Header Controls */}
          <div className="projects-header-section glass-panel">
            <div className="header-text-wrap">
              <div className="title-with-badge">
                <h1 className="projects-page-title">My Projects</h1>
                <span className="projects-count-pill">{pagination.total}</span>
              </div>
              <p className="projects-page-subtitle">
                Create, organize, and edit your persistent multi-file coding projects.
              </p>
            </div>

            <div className="header-actions-wrap">
              {/* Language Filter */}
              <select
                className="projects-filter-select"
                value={selectedLanguage}
                onChange={(e) => setSelectedLanguage(e.target.value)}
              >
                {LANG_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>

              {/* Create Button */}
              <button
                type="button"
                className="btn-create-project-primary"
                onClick={() => setNewProjectModalOpen(true)}
              >
                <Plus size={16} />
                <span>New Project</span>
              </button>
            </div>
          </div>

          {/* Projects Grid */}
          <div className="projects-grid-area">
            {loading ? (
              <div className="projects-skeleton-grid">
                {[1, 2, 3, 4, 5, 6].map((n) => (
                  <div key={n} className="project-card-skeleton glass-panel" />
                ))}
              </div>
            ) : filteredProjects.length === 0 ? (
              <div className="projects-empty-state glass-panel">
                <div className="empty-icon-box">
                  <FolderGit2 size={44} className="empty-main-icon" />
                </div>
                <h2 className="empty-title">
                  {searchQuery.trim()
                    ? `No projects matching "${searchQuery}"`
                    : "No projects yet"}
                </h2>
                <p className="empty-desc">
                  {searchQuery.trim()
                    ? "Try searching for a different keyword or clear your filter."
                    : "Start coding by creating your first persistent project workspace!"}
                </p>
                <button
                  type="button"
                  className="btn-create-first"
                  onClick={() => setNewProjectModalOpen(true)}
                >
                  <Plus size={16} />
                  <span>Create Project</span>
                </button>
              </div>
            ) : (
              <div className="projects-cards-grid">
                {filteredProjects.map((project) => {
                  const lang = project.defaultLanguage || project.language || "javascript";
                  const langColor = getLangColor(lang);

                  return (
                    <div key={project.id} className="project-card glass-panel">
                      <div className="card-top-row">
                        <div className="card-title-group">
                          <div
                            className="card-lang-indicator"
                            style={{ backgroundColor: langColor }}
                          />
                          <h3 className="card-project-name" title={project.name}>
                            {project.name}
                          </h3>
                        </div>

                        {/* 3-dots Menu */}
                        <div
                          className="card-menu-wrap"
                          ref={activeProjectMenu === project.id ? menuRef : null}
                        >
                          <button
                            type="button"
                            className="btn-card-dots"
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

                          {activeProjectMenu === project.id && (
                            <div className="card-dropdown glass-panel">
                              <button
                                type="button"
                                className="dropdown-item"
                                onClick={() => handleRenameProject(project)}
                                disabled={actionLoading}
                              >
                                <Edit3 size={14} />
                                <span>Rename</span>
                              </button>
                              <button
                                type="button"
                                className="dropdown-item"
                                onClick={() => handleDuplicateProject(project)}
                                disabled={actionLoading}
                              >
                                <Copy size={14} />
                                <span>Duplicate</span>
                              </button>
                              <button
                                type="button"
                                className="dropdown-item delete-item"
                                onClick={() => handleDeleteProject(project.id, project.name)}
                                disabled={actionLoading}
                              >
                                <Trash2 size={14} />
                                <span>Delete</span>
                              </button>
                            </div>
                          )}
                        </div>
                      </div>

                      <p className="card-description">
                        {project.description || "No description provided."}
                      </p>

                      <div className="card-meta-row">
                        <span className="card-lang-badge" style={{ color: langColor, borderColor: `${langColor}40` }}>
                          {lang.toUpperCase()}
                        </span>
                        <span className="card-files-badge">
                          {project.fileCount || 1} {project.fileCount === 1 ? "file" : "files"}
                        </span>
                        <span className="card-time-badge">
                          <Clock size={12} />
                          <span>{new Date(project.updatedAt).toLocaleDateString()}</span>
                        </span>
                      </div>

                      <div className="card-footer-row">
                        <button
                          type="button"
                          className="btn-open-workspace"
                          onClick={() => handleOpenProject(project)}
                        >
                          <span>Open Workspace</span>
                          <ExternalLink size={14} />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </main>

      {/* CREATE PROJECT MODAL */}
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
                  placeholder="e.g. Data Structures & Algorithms"
                  value={newProjName}
                  onChange={(e) => setNewProjName(e.target.value)}
                  autoFocus
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">Primary Language</label>
                <select
                  className="form-input form-select"
                  value={newProjLang}
                  onChange={(e) => setNewProjLang(e.target.value)}
                >
                  <option value="javascript">JavaScript (Node.js)</option>
                  <option value="python">Python 3.12</option>
                  <option value="cpp">C++ (GCC 14)</option>
                  <option value="c">C (GCC 14)</option>
                  <option value="java">Java (OpenJDK 17)</option>
                  <option value="html">HTML / CSS</option>
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Description (optional)</label>
                <textarea
                  rows={3}
                  className="form-textarea"
                  placeholder="Describe what you plan to build..."
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
