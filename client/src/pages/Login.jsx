
import { useState } from "react";
import {
    ArrowLeft,
    ArrowRight,
    Code2,
    Eye,
    EyeOff,
    LockKeyhole,
    Mail,
    ShieldCheck,
    Sparkles,
    Terminal,
    UsersRound,
} from "lucide-react";
import { Link } from "react-router-dom";
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
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [showPassword, setShowPassword] = useState(false);
    const [rememberMe, setRememberMe] = useState(true);
    const [message, setMessage] = useState("");

    function handleSubmit(event) {
        event.preventDefault();

        setMessage(
            "Form validation passed. Authentication is not connected yet; you have not been signed in."
        );
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
                                    Explore room-based coding workflows.
                                </small>
                            </span>
                        </div>

                        <div className="auth-benefit">
                            <span className="auth-benefit-icon">
                                <ShieldCheck size={18} />
                            </span>
                            <span>
                                <strong>Designed around your flow</strong>
                                <small>
                                    A focused interface for developer productivity.
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
                            Welcome back<span className="auth-gradient-text">.</span>
                        </h2>
                        <p>Enter your details to continue to your workspace.</p>
                    </div>

                    <form
                        className="auth-form"
                        onSubmit={(event) => {
                            event.preventDefault();
                            setMessage(
                                "Form validation passed. Authentication is not connected yet; you have not been signed in."
                            );
                        }}
                    >
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
                                        "Password recovery will be available after authentication is implemented."
                                    )
                                }
                            >
                                Forgot password?
                            </button>
                        </div>

                        <button className="auth-submit" type="submit">
                            Sign in <ArrowRight size={16} />
                        </button>

                        {message && (
                            <div className="auth-feedback" role="status">
                                <ShieldCheck size={16} />
                                <span>{message}</span>
                            </div>
                        )}
                    </form>

                    <div className="auth-divider">OR</div>

                    <Link className="auth-submit" to="/compiler">
                        <Terminal size={16} />
                        Open public compiler
                        <ArrowRight size={16} />
                    </Link>

                    <p className="auth-switch">
                        New to CoCode?
                        <Link to="/signup">Create an account</Link>
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
