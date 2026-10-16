
import { useMemo, useState } from "react";
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
    Gauge,
    GitBranch,
    LayoutDashboard,
    LogOut,
    MoreHorizontal,
    Plus,
    Search,
    Settings,
    Sparkles,
    Star,
    Terminal,
    UsersRound,
    X,
    Zap,
} from "lucide-react";
import { Link } from "react-router-dom";
import "./Dashboard.css";

const INITIAL_PROJECTS = [
    {
        id: 1,
        name: "Portfolio Website",
        description: "Personal website and portfolio",
        language: "JavaScript",
        code: "JS",
        color: "violet",
        updated: "Today",
        branch: "main",
        favorite: true,
    },
    {
        id: 2,
        name: "Algorithm Playground",
        description: "Practice problems and algorithms",
        language: "Python",
        code: "Py",
        color: "cyan",
        updated: "Yesterday",
        branch: "main",
        favorite: false,
    },
    {
        id: 3,
        name: "Data Structures",
        description: "Learning notes and code examples",
        language: "C++",
        code: "C+",
        color: "pink",
        updated: "2 days ago",
        branch: "develop",
        favorite: true,
    },
];

function Dashboard() {
    const [projects, setProjects] = useState(INITIAL_PROJECTS);
    const [search, setSearch] = useState("");
    const [filter, setFilter] = useState("All projects");
    const [notice, setNotice] = useState("");

    const filteredProjects = useMemo(() => {
        const query = search.trim().toLowerCase();

        return projects.filter((project) => {
            const matchesSearch =
                !query ||
                project.name.toLowerCase().includes(query) ||
                project.description.toLowerCase().includes(query) ||
                project.language.toLowerCase().includes(query);

            const matchesFilter =
                filter === "All projects" ||
                (filter === "Favorites" && project.favorite) ||
                (filter === "Recent" &&
                    ["Today", "Yesterday"].includes(project.updated));

            return matchesSearch && matchesFilter;
        });
    }, [projects, search, filter]);

    function toggleFavorite(id) {
        setProjects((current) =>
            current.map((project) =>
                project.id === id
                    ? { ...project, favorite: !project.favorite }
                    : project
            )
        );
    }

    function showNotice(message) {
        setNotice(message);
        window.setTimeout(() => setNotice(""), 3000);
    }

    return (
        <main className="dashboard-page">
            <aside className="dashboard-sidebar">
                <Link className="dash-brand" to="/" aria-label="CoCode home">
                    <span className="dash-brand-icon">C</span>
                    <span>Co<span>Code</span></span>
                    <span className="dash-brand-tag">DEV</span>
                </Link>

                <div className="sidebar-workspace">
                    <div className="workspace-avatar"><Code2 size={19} /></div>
                    <div className="workspace-details">
                        <strong>My workspace</strong>
                        <span>Personal space</span>
                    </div>
                    <ChevronDown size={15} />
                </div>

                <div className="sidebar-section-label">WORKSPACE</div>
                <nav className="dashboard-nav" aria-label="Dashboard navigation">
                    <Link className="dash-nav-item active" to="/dashboard">
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

                <div className="sidebar-section-label sidebar-section-spaced">
                    PREFERENCES
                </div>
                <nav className="dashboard-nav" aria-label="Preferences">
                    <button
                        className="dash-nav-item"
                        type="button"
                        onClick={() => showNotice("Settings will be available in a later phase.")}
                    >
                        <Settings size={17} />
                        <span>Settings</span>
                    </button>
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
                    <div className="profile-avatar">JD</div>
                    <div className="profile-details">
                        <strong>Developer</strong>
                        <span>Guest workspace</span>
                    </div>
                    <Link to="/login" className="profile-menu" aria-label="Sign in">
                        <LogOut size={16} />
                    </Link>
                </div>
            </aside>

            <section className="dashboard-main">
                <header className="dashboard-topbar">
                    <div className="dash-breadcrumb">
                        <span>Workspace</span>
                        <span>/</span>
                        <strong>Overview</strong>
                    </div>

                    <div className="dashboard-top-actions">
                        <label className="dashboard-search">
                            <Search size={16} />
                            <input
                                type="search"
                                value={search}
                                onChange={(event) => {
                                    setSearch(event.target.value);
                                    document.getElementById("projects")?.scrollIntoView({
                                        behavior: "smooth",
                                        block: "nearest",
                                    });
                                }}
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

                        <Link to="/login" className="dash-auth-link">
                            Sign in
                        </Link>

                        <Link to="/signup" className="dash-auth-primary">
                            Create account <ArrowUpRight size={14} />
                        </Link>


                        <button
                            type="button"
                            className="dash-icon-button"
                            aria-label="Notifications"
                            onClick={() => showNotice("You're all caught up!")}
                        >
                            <Bell size={17} />
                            <i />
                        </button>
                        <div className="top-profile-avatar">D</div>
                    </div>
                </header>

                <div className="dashboard-content">
                    <section className="dashboard-welcome">
                        <div className="welcome-copy">
                            <div className="dashboard-eyebrow">
                                <Sparkles size={13} />
                                YOUR DEVELOPER SPACE
                            </div>
                            <h1>
                                Good to see you, <span>Developer.</span>
                            </h1>
                            <p>
                                Your workspace is ready. What are we building today?
                            </p>
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
                            <div className="stat-value">{projects.length.toString().padStart(2, "0")}</div>
                            <div className="stat-caption">Sample workspace projects</div>
                            <div className="stat-mini-bars" aria-hidden="true">
                                <i /><i /><i /><i /><i /><i /><i /><i />
                            </div>
                        </article>

                        <article className="dash-stat-card">
                            <div className="stat-topline">
                                <span>Favorites</span>
                                <span className="stat-icon stat-cyan"><Star size={17} /></span>
                            </div>
                            <div className="stat-value">
                                {projects.filter((project) => project.favorite).length
                                    .toString()
                                    .padStart(2, "0")}
                            </div>
                            <div className="stat-caption">Projects marked as favorites</div>
                            <div className="stat-trend"><ArrowUpRight size={13} /> Organize your ideas</div>
                        </article>

                        <article className="dash-stat-card">
                            <div className="stat-topline">
                                <span>Compiler</span>
                                <span className="stat-icon stat-green"><Gauge size={17} /></span>
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
                                <h2>Projects <span>{projects.length.toString().padStart(2, "0")}</span></h2>
                                <p>Pick up where your ideas left off.</p>
                            </div>
                            <button
                                className="dash-button dash-button-secondary"
                                type="button"
                                onClick={() => showNotice("Project saving will be connected to a backend in a later phase.")}
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
                                        onClick={() => setFilter(item)}
                                    >
                                        {item}
                                        {item === "Favorites" && <Star size={12} />}
                                    </button>
                                ))}
                            </div>
                            <span className="project-sort"><Clock3 size={13} /> Recently updated</span>
                        </div>

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
                                                aria-label={project.favorite ? "Remove favorite" : "Add favorite"}
                                                aria-pressed={project.favorite}
                                                onClick={() => toggleFavorite(project.id)}
                                            >
                                                <Star size={16} fill={project.favorite ? "currentColor" : "none"} />
                                            </button>
                                            <button
                                                type="button"
                                                className="project-more"
                                                aria-label={`More options for ${project.name}`}
                                                onClick={() => showNotice("Project options will be available with saved projects.")}
                                            >
                                                <MoreHorizontal size={18} />
                                            </button>
                                        </div>
                                    </div>

                                    <h3>{project.name}</h3>
                                    <p>{project.description}</p>

                                    <div className="project-card-meta">
                                        <span className="project-language"><FileCode2 size={12} /> {project.language}</span>
                                        <span><Clock3 size={12} /> {project.updated}</span>
                                    </div>

                                    <div className="project-card-footer">
                                        <span className="project-branch"><GitBranch size={13} /> {project.branch}</span>
                                        <Link to="/compiler" aria-label={`Open compiler for ${project.name}`}>
                                            Open workspace <ArrowUpRight size={14} />
                                        </Link>
                                    </div>
                                </article>
                            ))}

                            {filteredProjects.length === 0 && (
                                <div className="projects-empty-state">
                                    <Search size={22} />
                                    <strong>No projects found</strong>
                                    <p>Try another search or change the selected filter.</p>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setSearch("");
                                            setFilter("All projects");
                                        }}
                                    >
                                        Clear filters
                                    </button>
                                </div>
                            )}

                            <Link className="new-project-card" to="/compiler">
                                <span className="new-project-icon"><Plus size={23} /></span>
                                <strong>Start something new</strong>
                                <p>Open a fresh coding workspace and turn your next idea into code.</p>
                                <span className="new-project-link">Open compiler <ArrowRight size={14} /></span>
                            </Link>
                        </div>
                    </section>

                    <section className="dashboard-bottom-grid">
                        <article className="activity-card">
                            <div className="bottom-card-heading">
                                <div>
                                    <span className="dashboard-section-kicker">WORKSPACE PULSE</span>
                                    <h2>Recent activity</h2>
                                </div>
                                <Activity size={18} />
                            </div>
                            <div className="activity-row">
                                <span className="activity-icon activity-purple"><FileCode2 size={15} /></span>
                                <div><strong>Portfolio Website</strong><p>Sample project · JavaScript</p></div>
                                <span className="activity-time">Today</span>
                            </div>
                            <div className="activity-row">
                                <span className="activity-icon activity-blue"><Terminal size={15} /></span>
                                <div><strong>Compiler workspace</strong><p>Public coding access</p></div>
                                <span className="activity-time">Anytime</span>
                            </div>
                            <div className="activity-row">
                                <span className="activity-icon activity-green"><UsersRound size={15} /></span>
                                <div><strong>Room collaboration</strong><p>Ready to start a room</p></div>
                                <span className="activity-time">Explore</span>
                            </div>
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
                        <span>CoCode <span>·</span> Think clearly. Build boldly.</span>
                        <span><i /> Developer preview</span>
                        <Link to="/">Back to homepage ↑</Link>
                    </footer>
                </div>
            </section>

            {notice && (
                <div className="dashboard-toast" role="status">
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
