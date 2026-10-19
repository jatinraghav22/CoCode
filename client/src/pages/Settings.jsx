
import {
    ArrowLeft,
    Check,
    Monitor,
    Moon,
    Palette,
    RotateCcw,
    Sparkles,
} from "lucide-react";
import { Link } from "react-router-dom";
import { DEFAULT_THEME, useTheme } from "../ThemeContext.jsx";
import "./Settings.css";

export default function Settings() {
    const { theme, themes, changeTheme } = useTheme();
    const selectedTheme = themes.find((item) => item.id === theme);

    return (
        <main className="settings-page">
            <header className="settings-topbar">
                <Link className="settings-brand" to="/">
                    <span className="settings-brand-icon">C</span>
                    <span>Co<span>Code</span></span>
                </Link>

                <Link className="settings-back" to="/dashboard">
                    <ArrowLeft size={15} />
                    Back to dashboard
                </Link>
            </header>

            <div className="settings-layout">
                <aside className="settings-sidebar">
                    <div className="settings-sidebar-label">PREFERENCES</div>
                    <a className="settings-nav-item active" href="#appearance">
                        <Palette size={17} />
                        Appearance
                    </a>
                    <a className="settings-nav-item" href="#theme-preview">
                        <Monitor size={17} />
                        Theme preview
                    </a>
                    <a className="settings-nav-item" href="#theme-behaviour">
                        <Moon size={17} />
                        Theme behaviour
                    </a>

                    <div className="settings-sidebar-note">
                        <Sparkles size={18} />
                        <strong>Make it yours.</strong>
                        <p>Choose a look that makes your coding workspace feel right.</p>
                    </div>
                </aside>

                <section className="settings-main">
                    <div className="settings-heading">
                        <div className="settings-eyebrow">
                            <span />
                            PERSONALIZE YOUR WORKSPACE
                        </div>

                        <h1>Appearance<span>.</span></h1>

                        <p>
                            Choose the colors that suit your style. Your theme applies
                            across CoCode and is remembered by this browser.
                        </p>
                    </div>

                    <section className="settings-section" id="appearance">
                        <div className="settings-section-heading">
                            <div>
                                <h2>Color themes</h2>
                                <p>Select one of the five CoCode themes.</p>
                            </div>

                            <button
                                className="settings-reset"
                                type="button"
                                onClick={() => changeTheme(DEFAULT_THEME)}
                            >
                                <RotateCcw size={14} />
                                Reset default
                            </button>
                        </div>

                        <div className="theme-card-grid">
                            {themes.map((item, index) => {
                                const isSelected = theme === item.id;

                                return (
                                    <button
                                        type="button"
                                        key={item.id}
                                        className={`theme-choice ${isSelected ? "selected" : ""}`}
                                        aria-pressed={isSelected}
                                        onClick={() => changeTheme(item.id)}
                                        style={{
                                            "--preview-bg": item.tokens.bg,
                                            "--preview-surface": item.tokens.surface,
                                            "--preview-raised": item.tokens.raised,
                                            "--preview-primary": item.tokens.primary,
                                            "--preview-secondary": item.tokens.secondary,
                                            "--preview-accent": item.tokens.accent,
                                            "--theme-index": index,
                                        }}
                                    >
                                        <div className="theme-mini-preview" aria-hidden="true">
                                            <div className="mini-window-top">
                                                <span />
                                                <span />
                                                <span />
                                                <i />
                                            </div>

                                            <div className="mini-window-body">
                                                <div className="mini-sidebar">
                                                    <span className="mini-logo" />
                                                    <span className="mini-nav active" />
                                                    <span className="mini-nav" />
                                                    <span className="mini-nav" />
                                                </div>

                                                <div className="mini-content">
                                                    <div className="mini-heading" />
                                                    <div className="mini-copy" />
                                                    <div className="mini-copy short" />

                                                    <div className="mini-panels">
                                                        <span />
                                                        <span />
                                                        <span />
                                                    </div>

                                                    <div className="mini-code">
                                                        <i />
                                                        <i />
                                                        <i />
                                                        <i />
                                                    </div>

                                                    <div className="mini-action" />
                                                </div>
                                            </div>
                                        </div>

                                        <div className="theme-choice-info">
                                            <div className="theme-choice-title">
                                                <strong>{item.name}</strong>
                                                {isSelected && (
                                                    <span className="theme-selected-icon">
                                                        <Check size={13} />
                                                    </span>
                                                )}
                                            </div>

                                            <span className="theme-choice-description">
                                                {item.description}
                                            </span>

                                            <div className="theme-swatches" aria-label="Theme colors">
                                                {item.colors.map((color) => (
                                                    <span
                                                        key={color}
                                                        style={{ background: color }}
                                                        title={color}
                                                    />
                                                ))}
                                            </div>

                                            <span className="theme-choice-action">
                                                {isSelected ? "Currently selected" : "Select theme"}
                                            </span>
                                        </div>
                                    </button>
                                );
                            })}
                        </div>
                    </section>

                    <section
                        className="settings-section settings-preview-section"
                        id="theme-preview"
                    >
                        <div className="settings-section-heading">
                            <div>
                                <h2>Live preview</h2>
                                <p>Your selected theme's colors and interface accents.</p>
                            </div>
                        </div>

                        <div
                            className="settings-live-preview"
                            style={{
                                "--preview-bg": selectedTheme.tokens.bg,
                                "--preview-surface": selectedTheme.tokens.surface,
                                "--preview-raised": selectedTheme.tokens.raised,
                                "--preview-primary": selectedTheme.tokens.primary,
                                "--preview-secondary": selectedTheme.tokens.secondary,
                                "--preview-accent": selectedTheme.tokens.accent,
                                "--preview-text": selectedTheme.tokens.text,
                                "--preview-muted": selectedTheme.tokens.muted,
                                "--preview-border": selectedTheme.tokens.border,
                                "--preview-glow": selectedTheme.tokens.glow,
                            }}
                        >
                            <div className="live-preview-toolbar">
                                <span className="live-preview-logo">C</span>
                                <strong>CoCode</strong>
                                <span className="live-preview-page">Workspace / Overview</span>
                                <span className="live-preview-badge">
                                    <i /> LIVE PREVIEW
                                </span>
                            </div>

                            <div className="live-preview-body">
                                <div className="live-preview-copy">
                                    <span>YOUR DEVELOPER SPACE</span>
                                    <h3>Build something great.</h3>
                                    <p>A workspace that feels like yours.</p>
                                    <button type="button" tabIndex={-1}>
                                        Start coding ↗
                                    </button>
                                </div>

                                <div className="live-preview-editor">
                                    <div className="live-editor-title">
                                        <span />
                                        <span />
                                        <span />
                                        <strong>main.py</strong>
                                    </div>
                                    <div className="live-editor-code">
                                        <p><i>01</i> <span>def</span> greet(name):</p>
                                        <p><i>02</i> &nbsp;&nbsp;return <b>"Hello, "</b> + name</p>
                                        <p><i>03</i> </p>
                                        <p><i>04</i> print(greet(<b>"Developer"</b>))</p>
                                    </div>
                                    <div className="live-editor-output">
                                        <span>OUTPUT</span>
                                        Hello, Developer
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="settings-selected-summary">
                            <div>
                                <span className="settings-summary-label">ACTIVE THEME</span>
                                <strong>{selectedTheme.name}</strong>
                                <span>{selectedTheme.description}</span>
                            </div>

                            <div className="settings-summary-swatches">
                                {selectedTheme.colors.map((color) => (
                                    <span
                                        key={color}
                                        style={{ background: color }}
                                        title={color}
                                    />
                                ))}
                            </div>
                        </div>
                    </section>

                    <section
                        className="settings-section settings-behaviour"
                        id="theme-behaviour"
                    >
                        <div className="settings-behaviour-icon">
                            <Moon size={19} />
                        </div>

                        <div>
                            <h2>Saved on this browser</h2>
                            <p>
                                Your theme preference is stored locally. It remains selected
                                after a refresh on this browser, without requiring login.
                            </p>
                        </div>

                        <span className="settings-saved-tag">
                            <Check size={13} /> Auto-save
                        </span>
                    </section>

                    <footer className="settings-footer">
                        <Link to="/">CoCode</Link>
                        <span>Think clearly. Build boldly.</span>
                        <Link to="/compiler">Open public compiler ↗</Link>
                    </footer>
                </section>
            </div>
        </main>
    );
}
