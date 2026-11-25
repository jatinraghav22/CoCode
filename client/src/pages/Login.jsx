import React, { useState, useEffect } from "react";
import {
    ArrowLeft,
    ArrowRight,
    CheckCircle2,
    Code2,
    Eye,
    EyeOff,
    LoaderCircle,
    LockKeyhole,
    Mail,
    ShieldCheck,
    Sparkles,
    Terminal,
    UsersRound,
} from "lucide-react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../AuthContext.jsx";
import "./Auth.css";

function AuthBrand() {
    return (
        <Link className="auth-brand" to="/" aria-label="CoCode home">
            <span className="auth-brand-icon">C</span>
            <span>
                Co<span>Code</span>
            </span>
        </Link>
    );
}

export default function Login() {
    const { login, isAuthenticated } = useAuth();
    const location = useLocation();
    const navigate = useNavigate();

    const searchParams = new URLSearchParams(location.search);
    const redirectDestination = searchParams.get("redirect") || "/dashboard";

    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [showPassword, setShowPassword] = useState(false);
    const [rememberMe, setRememberMe] = useState(true);
    const [message, setMessage] = useState("");
    const [isSubmitting, setIsSubmitting] = useState(false);

    // If already authenticated, redirect to destination
    useEffect(() => {
        if (isAuthenticated) {
            navigate(redirectDestination, { replace: true });
        }
    }, [isAuthenticated, navigate, redirectDestination]);

    async function handleSubmit(event) {
        event.preventDefault();
        setMessage("");
        setIsSubmitting(true);

        const result = await login(email, password);
        setIsSubmitting(false);

        if (result.success) {
            navigate(redirectDestination, { replace: true });
        } else {
            setMessage(result.error);
        }
    }

    return (
        <main className="auth-page">
            <section className="auth-showcase">
                <AuthBrand />

                <div className="auth-showcase-content">
                    <div className="auth-eyebrow">
                        <Sparkles size={14} />
                        YOUR SPACE TO CREATE
                    </div>

                    <h1>
                        Welcome back.
                        <br />
                        <span className="auth-gradient-text">
                            Let's build something.
                        </span>
                    </h1>

                    <p>
                        Step back into your developer workspace. Your next idea starts
                        with a single line of code.
                    </p>

                    <div className="auth-benefits">
                        <div className="auth-benefit">
                            <span className="auth-benefit-icon">
                                <Terminal size={18} />
                            </span>
                            <span>
                                <strong>Your coding workspace</strong>
                                <small>
                                    Open the public compiler any time, even without signing in.
                                </small>
                            </span>
                        </div>

                        <div className="auth-benefit">
                            <span className="auth-benefit-icon">
                                <UsersRound size={18} />
                            </span>
                            <span>
                                <strong>Built for collaboration</strong>
                                <small>
                                    Create and join persistent live coding rooms.
                                </small>
                            </span>
                        </div>

                        <div className="auth-benefit">
                            <span className="auth-benefit-icon">
                                <ShieldCheck size={18} />
                            </span>
                            <span>
                                <strong>Authorized sessions</strong>
                                <small>
                                    Cryptographically signed bearer tokens keep your rooms secure.
                                </small>
                            </span>
                        </div>
                    </div>
                </div>

                <div className="auth-showcase-footer">
                    <Code2 size={14} />
                    <span>Think clearly. Build boldly.</span>
                </div>
            </section>

            <section className="auth-form-side">
                <div className="auth-form-wrap">
                    <div className="auth-mobile-brand">
                        <AuthBrand />
                    </div>

                    <Link className="auth-back-link" to="/">
                        <ArrowLeft size={14} />
                        Back to homepage
                    </Link>

                    <div className="auth-form-heading">
                        <div className="auth-eyebrow">ACCOUNT ACCESS</div>
                        <h2>
                            Sign in to <span className="auth-gradient-text">CoCode</span>
                        </h2>
                        <p>
                            {redirectDestination !== "/dashboard"
                                ? `Please sign in to access ${redirectDestination}.`
                                : "Enter your credentials to enter your developer dashboard."}
                        </p>
                    </div>

                    <form className="auth-form" onSubmit={handleSubmit}>
                        <div className="auth-field">
                            <label htmlFor="login-email">Email address</label>
                            <div className="auth-input-wrap">
                                <Mail size={16} />
                                <input
                                    id="login-email"
                                    type="email"
                                    autoComplete="email"
                                    placeholder="you@example.com"
                                    value={email}
                                    onChange={(event) => {
                                        setEmail(event.target.value);
                                        setMessage("");
                                    }}
                                    required
                                />
                            </div>
                        </div>

                        <div className="auth-field">
                            <label htmlFor="login-password">Password</label>
                            <div className="auth-input-wrap">
                                <LockKeyhole size={16} />
                                <input
                                    id="login-password"
                                    type={showPassword ? "text" : "password"}
                                    autoComplete="current-password"
                                    placeholder="Enter your password"
                                    value={password}
                                    onChange={(event) => {
                                        setPassword(event.target.value);
                                        setMessage("");
                                    }}
                                    required
                                />
                                <button
                                    className="auth-input-action"
                                    type="button"
                                    aria-label={showPassword ? "Hide password" : "Show password"}
                                    onClick={() => setShowPassword((value) => !value)}
                                >
                                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                                </button>
                            </div>
                        </div>

                        <div className="auth-form-options">
                            <label className="auth-check-label">
                                <input
                                    type="checkbox"
                                    checked={rememberMe}
                                    onChange={(event) => setRememberMe(event.target.checked)}
                                />
                                Remember me
                            </label>

                            <button
                                className="auth-text-button"
                                type="button"
                                onClick={() =>
                                    setMessage(
                                        "Password reset is currently unavailable. Please contact support or create a new account."
                                    )
                                }
                            >
                                Forgot password?
                            </button>
                        </div>

                        <button className="auth-submit" type="submit" disabled={isSubmitting}>
                            {isSubmitting ? (
                                <>
                                    <LoaderCircle size={16} style={{ animation: "spin 1s linear infinite" }} />
                                    <span>Signing in...</span>
                                </>
                            ) : (
                                <>
                                    <span>Sign in</span>
                                    <ArrowRight size={16} />
                                </>
                            )}
                        </button>

                        {message && (
                            <div className="auth-feedback" role="status">
                                {message.includes("successful") ? (
                                    <CheckCircle2 size={16} style={{ color: "#10b981" }} />
                                ) : (
                                    <ShieldCheck size={16} style={{ color: "#f43f5e" }} />
                                )}
                                <span>{message}</span>
                            </div>
                        )}
                    </form>

                    <div className="auth-divider">OR</div>

                    <Link className="auth-submit" to="/compiler">
                        <Terminal size={16} />
                        Open public compiler (Guest access)
                        <ArrowRight size={16} />
                    </Link>

                    <p className="auth-switch">
                        New to CoCode?
                        <Link to={`/signup${location.search}`}>Create an account</Link>
                    </p>

                    <div className="auth-footer-links">
                        <Link to="/">Home</Link>
                        <Link to="/compiler">Public compiler</Link>
                    </div>
                </div>
            </section>
        </main>
    );
}
