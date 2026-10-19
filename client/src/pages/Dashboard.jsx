import { useEffect, useMemo, useRef, useState } from "react";
import {
    Activity,
    ArrowDownRight,
    ArrowRight,
    ArrowUpRight,
    Bell,
    Check,
    ChevronDown,
    CircleHelp,
    Clock3,
    Code2,
    Command,
    FileCode2,
    FolderKanban,
    GitBranch,
    LayoutDashboard,
    LogOut,
    Moon,
    Palette,
    PanelLeftClose,
    PanelLeftOpen,
    Plus,
    Search,
    Settings,
    Sparkles,
    Star,
    Terminal,
    Trash2,
    UsersRound,
    X,
    Zap,
} from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../AuthContext.jsx";
import { useTheme } from "../ThemeContext.jsx";
import "./Dashboard.css";

const PROJECTS_STORAGE_KEY = "cocode-dashboard-projects-v1";
const DAY_MS = 24 * 60 * 60 * 1000;

const INITIAL_PROJECTS = [];

const LANGUAGE_META = {
    JavaScript: { code: "JS", color: "violet" },
    Python: { code: "Py", color: "cyan" },
    "C++": { code: "C+", color: "pink" },
};

function normalizeProject(project, index) {
    if (!project || typeof project !== "object") return null;
    if (typeof project.name !== "string" || !project.name.trim()) return null;

    const language = LANGUAGE_META[project.language] ? project.language : "JavaScript";
    const meta = LANGUAGE_META[language];
    const legacyOffsets = { Today: 0, Yesterday: 1, "2 days ago": 3 };
    const fallbackOffset = legacyOffsets[project.updated] ?? index;
    const parsedUpdatedAt = Number(project.updatedAt);

    return {
        id: project.id ?? `restored-${index}-${project.name}`,
        name: project.name.trim(),
        description: typeof project.description === "string" ? project.description : "Coding workspace",
        language,
        code: meta.code,
        color: meta.color,
        updatedAt: Number.isFinite(parsedUpdatedAt) && parsedUpdatedAt > 0
            ? parsedUpdatedAt
            : Date.now() - fallbackOffset * DAY_MS,
        branch: typeof project.branch === "string" && project.branch.trim() ? project.branch : "main",
        favorite: Boolean(project.favorite),
    };
}

function readProjects() {
    if (typeof window === "undefined") return INITIAL_PROJECTS;

    try {
        const stored = window.localStorage.getItem(PROJECTS_STORAGE_KEY);
        if (!stored) return INITIAL_PROJECTS;
        const parsed = JSON.parse(stored);
        if (!Array.isArray(parsed)) return INITIAL_PROJECTS;
        return parsed.map(normalizeProject).filter((project) => project && !String(project.id).startsWith("sample-") && !["Portfolio Website", "Algorithm Playground", "Data Structures"].includes(project.name));
    } catch {
        return INITIAL_PROJECTS;
    }
}

function formatUpdated(timestamp) {
    const age = Math.max(0, Date.now() - Number(timestamp || 0));
    const days = Math.floor(age / DAY_MS);
    if (days === 0) return "Today";
    if (days === 1) return "Yesterday";
    if (days < 7) return `${days} days ago`;
    return new Date(timestamp).toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
        year: new Date(timestamp).getFullYear() === new Date().getFullYear() ? undefined : "numeric",
    });
}

function createProjectId() {
    if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
        return crypto.randomUUID();
    }
    return `project-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function Dashboard() {
    const { user, logout } = useAuth();
    const navigate = useNavigate();
    const [projects, setProjects] = useState(readProjects);
    const [search, setSearch] = useState("");
    const [filter, setFilter] = useState("All projects");
    const [sortBy, setSortBy] = useState("recent");
    const [notice, setNotice] = useState("");
    const [createOpen, setCreateOpen] = useState(false);
    const [projectName, setProjectName] = useState("");
    const [projectDescription, setProjectDescription] = useState("");
    const [projectLanguage, setProjectLanguage] = useState("JavaScript");
    const [storageAvailable, setStorageAvailable] = useState(true);
    const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
    const [headerVisible, setHeaderVisible] = useState(true);
    const [themeMenuOpen, setThemeMenuOpen] = useState(false);
    const lastScrollY = useRef(0);
    const { theme, themes, changeTheme } = useTheme();
    const searchRef = useRef(null);
    const projectNameRef = useRef(null);
    const noticeTimerRef = useRef(null);

    async function handleLogout() {
        await logout();
        navigate("/", { replace: true });
    }

    useEffect(() => {
        function handleScroll() {
            const currentY = window.scrollY;
            if (currentY < 24 || currentY < lastScrollY.current) setHeaderVisible(true);
            else if (currentY > lastScrollY.current + 4) setHeaderVisible(false);
            lastScrollY.current = currentY;
        }
        window.addEventListener("scroll", handleScroll, { passive: true });
        return () => window.removeEventListener("scroll", handleScroll);
    }, []);

    useEffect(() => {
        try {
            window.localStorage.setItem(PROJECTS_STORAGE_KEY, JSON.stringify(projects));
            setStorageAvailable(true);
        } catch {
            setStorageAvailable(false);
        }
    }, [projects]);

    useEffect(() => {
        function handleKeyboardShortcuts(event) {
            const isSearchShortcut = (event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k";
            if (isSearchShortcut) {
                event.preventDefault();
                searchRef.current?.focus();
                searchRef.current?.select();
            }

            if (event.key === "Escape" && createOpen) {
                setCreateOpen(false);
            }
        }

        window.addEventListener("keydown", handleKeyboardShortcuts);
        return () => window.removeEventListener("keydown", handleKeyboardShortcuts);
    }, [createOpen]);

    useEffect(() => {
        if (createOpen) projectNameRef.current?.focus();
    }, [createOpen]);

    useEffect(() => () => {
        if (noticeTimerRef.current) window.clearTimeout(noticeTimerRef.current);
    }, []);

    const favoriteCount = useMemo(
        () => projects.filter((project) => project.favorite).length,
        [projects]
    );

    const recentProjects = useMemo(
        () => [...projects].sort((a, b) => b.updatedAt - a.updatedAt).slice(0, 3),
        [projects]
    );

    const filteredProjects = useMemo(() => {
        const query = search.trim().toLowerCase();
        const matches = projects.filter((project) => {
            const searchableText = [project.name, project.description, project.language, project.branch]
                .join(" ")
                .toLowerCase();
            const matchesSearch = !query || searchableText.includes(query);
            const matchesFilter =
                filter === "All projects" ||
                (filter === "Favorites" && project.favorite) ||
                (filter === "Recent" && Date.now() - project.updatedAt <= 2 * DAY_MS);
            return matchesSearch && matchesFilter;
        });

        return matches.sort((a, b) => {
            if (sortBy === "name") return a.name.localeCompare(b.name);
            if (sortBy === "language") {
                return a.language.localeCompare(b.language) || a.name.localeCompare(b.name);
            }
            return b.updatedAt - a.updatedAt;
        });
    }, [projects, search, filter, sortBy]);

    function showNotice(message) {
        if (noticeTimerRef.current) window.clearTimeout(noticeTimerRef.current);
        setNotice(message);
        noticeTimerRef.current = window.setTimeout(() => setNotice(""), 3200);
    }

    function toggleFavorite(id) {
        setProjects((current) => current.map((project) =>
            project.id === id ? { ...project, favorite: !project.favorite } : project
        ));
    }

    function handleCreateProject(event) {
        event.preventDefault();
        const cleanName = projectName.trim();
        if (!cleanName) return;

        const meta = LANGUAGE_META[projectLanguage];
        const newProject = {
            id: createProjectId(),
            name: cleanName,
            description: projectDescription.trim() || `${projectLanguage} coding workspace`,
            language: projectLanguage,
            code: meta.code,
            color: meta.color,
            updatedAt: Date.now(),
            branch: "main",
            favorite: false,
        };

        setProjects((current) => [newProject, ...current]);
        setSearch("");
        setFilter("All projects");
        setSortBy("recent");
        setProjectName("");
        setProjectDescription("");
        setProjectLanguage("JavaScript");
        setCreateOpen(false);
        showNotice(`“${cleanName}” was added to your dashboard.`);
    }

    function removeProject(project) {
        const confirmed = window.confirm(
            `Remove “${project.name}” from this dashboard? This removes its dashboard entry from this browser; it does not delete source files.`
        );
        if (!confirmed) return;
        setProjects((current) => current.filter((item) => item.id !== project.id));
        showNotice(`Removed “${project.name}” from the dashboard.`);
    }

    function clearFilters() {
        setSearch("");
        setFilter("All projects");
        setSortBy("recent");
    }

    return (
        <main className={`dashboard-page ${sidebarCollapsed ? "sidebar-collapsed" : ""}`}>
            <aside className="dashboard-sidebar">
                <button className="sidebar-collapse-toggle" type="button" onClick={() => setSidebarCollapsed((value) => !value)} aria-label={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"} title={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}>{sidebarCollapsed ? <PanelLeftOpen size={17} /> : <PanelLeftClose size={17} />}</button>
                <Link className="dash-brand" to="/" aria-label="CoCode home">
                    <span className="dash-brand-icon">C</span>
                    <span>Co<span>Code</span></span>
                    <span className="dash-brand-tag">DEV</span>
                </Link>

                <div className="sidebar-workspace">
                    <div className="workspace-avatar"><Code2 size={19} /></div>
                    <div className="workspace-details">
                        <strong>My workspace</strong>
                        <span>{storageAvailable ? "Saved on this device" : "Browser storage unavailable"}</span>
                    </div>
                    <ChevronDown size={15} />
                </div>

                <div className="sidebar-section-label">WORKSPACE</div>
                <nav className="dashboard-nav" aria-label="Dashboard navigation">
                    <Link className="dash-nav-item active" to="/dashboard" aria-current="page">
                        <LayoutDashboard size={17} />
                        <span>Overview</span>
                    </Link>
                    <a className="dash-nav-item" href="#projects">
                        <FolderKanban size={17} />
                        <span>My projects</span>
                        <span className="nav-count">{projects.length}</span>
                    </a>
                    <Link className="dash-nav-item" to="/compiler">
                        <Terminal size={17} />
                        <span>Online compiler</span>
                        <span className="nav-new">OPEN</span>
                    </Link>
                    <Link className="dash-nav-item" to="/rooms/create">
                        <UsersRound size={17} />
                        <span>Collaboration rooms</span>
                    </Link>
                </nav>

                <div className="sidebar-section-label sidebar-section-spaced">PREFERENCES</div>
                <nav className="dashboard-nav" aria-label="Preferences">
                    <Link className="dash-nav-item" to="/settings">
                        <Settings size={17} />
                        <span>Settings</span>
                    </Link>
                    <button
                        className="dash-nav-item"
                        type="button"
                        onClick={() => showNotice("Help center is coming soon.")}
                    >
                        <CircleHelp size={17} />
                        <span>Help & support</span>
                    </button>
                </nav>

                <div className="sidebar-spacer" />

                <div className="sidebar-tip">
                    <div className="tip-orb"><Sparkles size={17} /></div>
                    <strong>Have an idea?</strong>
                    <p>Your next project can start with a single line of code.</p>
                    <Link to="/compiler">Open compiler <ArrowUpRight size={14} /></Link>
                </div>

                <div className="sidebar-profile">
                    <div className="profile-avatar"><UsersRound size={15} /></div>
                    <div className="profile-details">
                        <strong>{user?.name || "Developer"}</strong>
                        <span>{user?.email || "Authenticated"}</span>
                    </div>
                    <button
                        type="button"
                        className="profile-menu"
                        aria-label="Log out"
                        title="Log out"
                        onClick={handleLogout}
                        style={{ background: "none", border: "none", color: "#f43f5e", cursor: "pointer", display: "flex", alignItems: "center" }}
                    >
                        <LogOut size={16} />
                    </button>
                </div>
            </aside>

            <section className="dashboard-main">
                <header className={`dashboard-topbar ${headerVisible ? "topbar-visible" : "topbar-hidden"}`}>
                    <div className="dash-breadcrumb">
                        <span>Workspace</span>
                        <span>/</span>
                        <strong>Overview</strong>
                    </div>

                    <div className="dashboard-top-actions">
                        <label className="dashboard-search">
                            <Search size={16} aria-hidden="true" />
                            <input
                                ref={searchRef}
                                type="search"
                                value={search}
                                onChange={(event) => setSearch(event.target.value)}
                                placeholder="Search projects..."
                                aria-label="Search projects"
                            />
                            {search ? (
                                <button
                                    type="button"
                                    className="search-clear"
                                    aria-label="Clear search"
                                    onClick={() => setSearch("")}
                                >
                                    <X size={13} />
                                </button>
                            ) : (
                                <span className="search-shortcut"><Command size={11} /> K</span>
                            )}
                        </label>

                        <button
                            type="button"
                            className="dash-auth-link"
                            onClick={handleLogout}
                            style={{ display: "inline-flex", alignItems: "center", gap: 6, cursor: "pointer", background: "none", border: "none", color: "#bec2dd" }}
                        >
                            <LogOut size={14} />
                            <span>Sign out</span>
                        </button>

                        <div className="theme-picker-wrap">
                            <button type="button" className="dash-icon-button theme-picker-trigger" aria-label="Choose color theme" aria-expanded={themeMenuOpen} onClick={() => setThemeMenuOpen((open) => !open)}><Moon size={17} /></button>
                            {themeMenuOpen && <div className="theme-picker-popover" role="dialog" aria-label="Choose a theme">
                                <div className="theme-picker-heading"><Palette size={15} /><strong>Color theme</strong><button type="button" aria-label="Close theme menu" onClick={() => setThemeMenuOpen(false)}><X size={14} /></button></div>
                                {themes.map((item) => <button type="button" key={item.id} className={`theme-picker-option ${theme === item.id ? "selected" : ""}`} onClick={() => changeTheme(item.id)} aria-pressed={theme === item.id}>
                                    <span className="theme-picker-swatches">{item.colors.slice(1, 4).map((color) => <i key={color} style={{ background: color }} />)}</span><span>{item.name}</span>{theme === item.id && <Check size={14} />}
                                </button>)}
                                <Link to="/settings" className="theme-picker-settings" onClick={() => setThemeMenuOpen(false)}>All appearance settings <ArrowUpRight size={13} /></Link>
                            </div>}
                        </div>
                        <button
                            type="button"
                            className="dash-icon-button"
                            aria-label="Notifications"
                            onClick={() => showNotice("You’re all caught up!")}
                        >
                            <Bell size={17} />
                            <i />
                        </button>

                    </div>
                </header>

                <div className="dashboard-content">
                    <section className="dashboard-welcome">
                        <div className="welcome-copy">
                            <div className="dashboard-eyebrow">
                                <Sparkles size={13} />
                                DEVELOPER DASHBOARD
                            </div>
                            <h1>Welcome back, <span>{user?.name || "Developer"}.</span></h1>
                            <p>Your authenticated workspace is ready. What are we building today?</p>
                            <div className="welcome-actions">
                                <Link className="dash-button dash-button-primary" to="/compiler">
                                    <Terminal size={16} /> Open compiler <ArrowUpRight size={15} />
                                </Link>
                                <Link className="dash-button dash-button-secondary" to="/rooms/create">
                                    <Plus size={16} /> Create a room
                                </Link>
                            </div>
                        </div>
                        <div className="welcome-art" aria-hidden="true">
                            <div className="welcome-art-ring art-ring-a" />
                            <div className="welcome-art-ring art-ring-b" />
                            <div className="welcome-code-core">&lt;/&gt;</div>
                            <div className="welcome-art-chip chip-a">JS</div>
                            <div className="welcome-art-chip chip-b">Py</div>
                            <div className="welcome-art-chip chip-c"><Zap size={16} /></div>
                        </div>
                        <div className="welcome-shimmer" />
                    </section>

                    <section className="dashboard-stats" aria-label="Workspace summary">
                        <article className="dash-stat-card">
                            <div className="stat-topline">
                                <span>Total projects</span>
                                <span className="stat-icon stat-violet"><FolderKanban size={17} /></span>
                            </div>
                            <div className="stat-value">{String(projects.length).padStart(2, "0")}</div>
                            <div className="stat-caption">Dashboard entries saved in this browser</div>
                            <div className="stat-mini-bars" aria-hidden="true">
                                <i /><i /><i /><i /><i /><i /><i /><i />
                            </div>
                        </article>

                        <article className="dash-stat-card">
                            <div className="stat-topline">
                                <span>Favorites</span>
                                <span className="stat-icon stat-cyan"><Star size={17} /></span>
                            </div>
                            <div className="stat-value">{String(favoriteCount).padStart(2, "0")}</div>
                            <div className="stat-caption">Favorites persist after refresh</div>
                            <button
                                className="stat-action stat-action-button"
                                type="button"
                                onClick={() => {
                                    setFilter("Favorites");
                                    document.getElementById("projects")?.scrollIntoView({ behavior: "smooth", block: "start" });
                                }}
                            >
                                View favorites <ArrowRight size={13} />
                            </button>
                        </article>

                        <article className="dash-stat-card">
                            <div className="stat-topline">
                                <span>Compiler</span>
                                <span className="stat-icon stat-green"><Activity size={17} /></span>
                            </div>
                            <div className="stat-value stat-word">Ready</div>
                            <div className="stat-caption">Public access · No login required</div>
                            <Link className="stat-action" to="/compiler">
                                Start a session <ArrowRight size={13} />
                            </Link>
                        </article>
                    </section>

                    <section className="dashboard-project-section" id="projects">
                        <div className="dashboard-section-heading">
                            <div>
                                <div className="dashboard-section-kicker">YOUR WORKSPACE</div>
                                <h2>Projects <span>{String(projects.length).padStart(2, "0")}</span></h2>
                                <p>Search, sort, favorite, and organize your local project list.</p>
                            </div>
                            <button
                                className="dash-button dash-button-secondary"
                                type="button"
                                onClick={() => setCreateOpen(true)}
                            >
                                <Plus size={15} /> New project
                            </button>
                        </div>

                        <div className="project-toolbar">
                            <div className="project-filters" aria-label="Project filters">
                                {["All projects", "Recent", "Favorites"].map((item) => (
                                    <button
                                        key={item}
                                        type="button"
                                        className={filter === item ? "selected" : ""}
                                        aria-pressed={filter === item}
                                        onClick={() => setFilter(item)}
                                    >
                                        {item}
                                        {item === "Favorites" && <Star size={12} />}
                                    </button>
                                ))}
                            </div>
                            <label className="project-sort project-sort-control">
                                <Clock3 size={13} />
                                <span>Sort:</span>
                                <select
                                    className="project-sort-select"
                                    value={sortBy}
                                    onChange={(event) => setSortBy(event.target.value)}
                                    aria-label="Sort projects"
                                >
                                    <option value="recent">Recently updated</option>
                                    <option value="name">Name A–Z</option>
                                    <option value="language">Language</option>
                                </select>
                            </label>
                        </div>
                        <p className="project-results-count" aria-live="polite">
                            Showing {filteredProjects.length} of {projects.length} projects
                        </p>

                        <div className="dashboard-project-grid">
                            {filteredProjects.map((project, index) => (
                                <article
                                    className="dashboard-project-card"
                                    key={project.id}
                                    style={{ "--card-index": index }}
                                >
                                    <div className="project-card-heading">
                                        <span className={`project-language-icon ${project.color}`}>
                                            {project.code}
                                        </span>
                                        <div className="project-card-actions">
                                            <button
                                                type="button"
                                                className={`favorite-toggle ${project.favorite ? "is-favorite" : ""}`}
                                                aria-label={project.favorite ? `Remove ${project.name} from favorites` : `Add ${project.name} to favorites`}
                                                aria-pressed={project.favorite}
                                                onClick={() => toggleFavorite(project.id)}
                                            >
                                                <Star size={16} fill={project.favorite ? "currentColor" : "none"} />
                                            </button>
                                            <button
                                                type="button"
                                                className="project-more"
                                                aria-label={`Remove ${project.name} from dashboard`}
                                                title="Remove from dashboard"
                                                onClick={() => removeProject(project)}
                                            >
                                                <Trash2 size={16} />
                                            </button>
                                        </div>
                                    </div>

                                    <h3>{project.name}</h3>
                                    <p>{project.description}</p>

                                    <div className="project-card-meta">
                                        <span className="project-language"><FileCode2 size={12} /> {project.language}</span>
                                        <span><Clock3 size={12} /> {formatUpdated(project.updatedAt)}</span>
                                    </div>

                                    <div className="project-card-footer">
                                        <span className="project-branch"><GitBranch size={13} /> {project.branch}</span>
                                        <Link to="/compiler" aria-label={`Open compiler for ${project.name}`}>
                                            Open compiler <ArrowUpRight size={14} />
                                        </Link>
                                    </div>
                                </article>
                            ))}

                            {filteredProjects.length === 0 && (
                                <div className="projects-empty-state">
                                    <Search size={22} />
                                    <strong>{projects.length === 0 ? "Your dashboard is clear" : "No projects found"}</strong>
                                    <p>{projects.length === 0
                                        ? "Create a project entry to keep your workspace organized."
                                        : "Try another search, sort option, or filter."}</p>
                                    {projects.length === 0 ? (
                                        <button type="button" onClick={() => setCreateOpen(true)}>Create your first project</button>
                                    ) : (
                                        <button type="button" onClick={clearFilters}>Clear filters</button>
                                    )}
                                </div>
                            )}

                            <button className="new-project-card" type="button" onClick={() => setCreateOpen(true)}>
                                <span className="new-project-icon"><Plus size={23} /></span>
                                <strong>Start something new</strong>
                                <p>Add a project entry to your personal dashboard. Source-code storage is not connected yet.</p>
                                <span className="new-project-link">Create project <ArrowRight size={14} /></span>
                            </button>
                        </div>
                    </section>

                    <section className="dashboard-bottom-grid">
                        <article className="activity-card">
                            <div className="bottom-card-heading">
                                <div>
                                    <span className="dashboard-section-kicker">WORKSPACE PULSE</span>
                                    <h2>Recently updated</h2>
                                </div>
                                <Activity size={18} />
                            </div>
                            {recentProjects.length ? recentProjects.map((project) => (
                                <div className="activity-row" key={project.id}>
                                    <span className="activity-icon activity-purple"><FileCode2 size={15} /></span>
                                    <div>
                                        <strong>{project.name}</strong>
                                        <p>{project.language} · {project.favorite ? "Favorite" : "Project entry"}</p>
                                    </div>
                                    <span className="activity-time">{formatUpdated(project.updatedAt)}</span>
                                </div>
                            )) : (
                                <div className="activity-empty">Your recent project updates will appear here.</div>
                            )}
                        </article>

                        <article className="quick-actions-card">
                            <div className="bottom-card-heading">
                                <div>
                                    <span className="dashboard-section-kicker">JUMP RIGHT IN</span>
                                    <h2>Quick actions</h2>
                                </div>
                                <Zap size={18} />
                            </div>
                            <Link to="/compiler" className="quick-action-row">
                                <span className="quick-action-icon quick-violet"><Code2 size={17} /></span>
                                <span><strong>Open compiler</strong><small>Run code without logging in</small></span>
                                <ArrowUpRight size={16} />
                            </Link>
                            <Link to="/rooms/create" className="quick-action-row">
                                <span className="quick-action-icon quick-cyan"><UsersRound size={17} /></span>
                                <span><strong>Create a room</strong><small>Start a collaboration space</small></span>
                                <ArrowUpRight size={16} />
                            </Link>
                            <Link to="/rooms/join" className="quick-action-row">
                                <span className="quick-action-icon quick-green"><ArrowDownRight size={17} /></span>
                                <span><strong>Join a room</strong><small>Enter a room code</small></span>
                                <ArrowUpRight size={16} />
                            </Link>
                        </article>
                    </section>

                    <footer className="dashboard-footer">
                        <span>CoCode DEV <span>·</span> Think clearly. Build boldly.</span>
                        <nav aria-label="Footer links"><Link to="/" onClick={() => showNotice("About CoCode — a focused coding workspace.")}>About</Link><Link to="/" onClick={() => showNotice("Made for developers, learners, and curious minds.")}>Made by</Link><Link to="/" onClick={() => showNotice("Security information will be published here.")}>Security</Link><Link to="/" onClick={() => showNotice("Terms will be published here.")}>Terms</Link><Link to="/" onClick={() => showNotice("Privacy information will be published here.")}>Privacy Policy</Link></nav>
                        <span>© {new Date().getFullYear()} CoCode</span>
                    </footer>
                </div>
            </section>

            {createOpen && (
                <div
                    className="project-modal-backdrop"
                    onMouseDown={(event) => {
                        if (event.target === event.currentTarget) setCreateOpen(false);
                    }}
                >
                    <section
                        className="project-modal"
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby="project-modal-title"
                        aria-describedby="project-modal-description"
                    >
                        <div className="project-modal-heading">
                            <span className="project-modal-icon"><FolderKanban size={20} /></span>
                            <button type="button" className="project-modal-close" aria-label="Close dialog" onClick={() => setCreateOpen(false)}>
                                <X size={17} />
                            </button>
                            <div>
                                <h2 id="project-modal-title">Create a project</h2>
                                <p id="project-modal-description">Add a project entry to your dashboard. This is saved in this browser only.</p>
                            </div>
                        </div>

                        <form className="project-create-form" onSubmit={handleCreateProject}>
                            <label>
                                <span>Project name <b aria-hidden="true">*</b></span>
                                <input
                                    ref={projectNameRef}
                                    value={projectName}
                                    onChange={(event) => setProjectName(event.target.value)}
                                    maxLength={60}
                                    placeholder="e.g. Weather App"
                                    required
                                />
                            </label>
                            <label>
                                <span>Description</span>
                                <textarea
                                    value={projectDescription}
                                    onChange={(event) => setProjectDescription(event.target.value)}
                                    maxLength={160}
                                    rows={3}
                                    placeholder="What are you building?"
                                />
                            </label>
                            <label>
                                <span>Primary language</span>
                                <select value={projectLanguage} onChange={(event) => setProjectLanguage(event.target.value)}>
                                    <option>JavaScript</option>
                                    <option>Python</option>
                                    <option>C++</option>
                                </select>
                            </label>
                            <div className="project-modal-note">
                                <CircleHelp size={14} /> This creates a dashboard record, not a source-code file or cloud project.
                            </div>
                            <div className="project-modal-actions">
                                <button type="button" className="dash-button dash-button-secondary" onClick={() => setCreateOpen(false)}>Cancel</button>
                                <button type="submit" className="dash-button dash-button-primary"><Plus size={15} /> Create project</button>
                            </div>
                        </form>
                    </section>
                </div>
            )}

            {notice && (
                <div className="dashboard-toast" role="status" aria-live="polite">
                    <Check size={16} />
                    <span>{notice}</span>
                    <button type="button" aria-label="Dismiss message" onClick={() => setNotice("")}>
                        <X size={14} />
                    </button>
                </div>
            )}
        </main>
    );
}

export default Dashboard;
