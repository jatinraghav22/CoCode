
import { useState, useEffect } from "react";
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
    UserRound,
    UsersRound,
} from "lucide-react";
import { useAuth } from "../AuthContext.jsx";
import { Link, useLocation, useNavigate } from "react-router-dom";
import "./Auth.css";

function SignupBrand() {
    return (
        <Link className="auth-brand" to="/" aria-label="CoCode home">
            <span className="auth-brand-icon">C</span>
            <span>
                Co<span>Code</span>
            </span>
        </Link>
    );
}

export default function Signup() {
    const { register, isAuthenticated } = useAuth();
    const location = useLocation();
    const navigate = useNavigate();

    const searchParams = new URLSearchParams(location.search);
    const redirectDestination = searchParams.get("redirect") || "/dashboard";

    const [name, setName] = useState("");
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);
    const [acceptedTerms, setAcceptedTerms] = useState(false);
    const [message, setMessage] = useState("");
    const [isError, setIsError] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);

    useEffect(() => {
        if (isAuthenticated) {
            navigate(redirectDestination, { replace: true });
        }
    }, [isAuthenticated, navigate, redirectDestination]);

    async function handleSubmit(event) {
        event.preventDefault();
        setMessage("");
        setIsError(false);

        if (name.trim().length < 2) {
            setIsError(true);
            setMessage("Please enter a name with at least 2 characters.");
            return;
        }

        if (password.length < 8) {
            setIsError(true);
            setMessage("Your password must contain at least 8 characters.");
            return;
        }

        if (password !== confirmPassword) {
            setIsError(true);
            setMessage("Your passwords do not match. Please try again.");
            return;
        }

        if (!acceptedTerms) {
            setIsError(true);
            setMessage("Please accept the Terms of Service and Privacy Policy.");
            return;
        }

        setIsSubmitting(true);
        const result = await register(name, email, password);
        setIsSubmitting(false);

        if (result.success) {
            navigate(redirectDestination, { replace: true });
        } else {
            setIsError(true);
            setMessage(result.error);
        }
    }

    function clearMessage() {
        setMessage("");
        setIsError(false);
    }

    return (
        <main className="auth-page">
            <section className="auth-showcase">
                <SignupBrand />

                <div className="auth-showcase-content">
                    <div className="auth-eyebrow">
                        <Sparkles size={14} />
                        YOUR NEXT CHAPTER
                    </div>

                    <h1>
                        Create.
                        <br />
                        Collaborate.
                        <br />
                        <span className="auth-gradient-text">Go beyond.</span>
                    </h1>

                    <p>
                        Make room for your ideas. Explore your coding workspace,
                        experiment with new projects and get ready to build together.
                    </p>

                    <div className="auth-benefits">
                        <div className="auth-benefit">
                            <span className="auth-benefit-icon">
                                <Code2 size={18} />
                            </span>
                            <span>
                                <strong>Your coding space</strong>
                                <small>
                                    Open the public compiler even without an account.
                                </small>
                            </span>
                        </div>

                        <div className="auth-benefit">
                            <span className="auth-benefit-icon">
                                <UsersRound size={18} />
                            </span>
                            <span>
                                <strong>Build better together</strong>
                                <small>
                                    Explore room-based collaboration experiences.
                                </small>
                            </span>
                        </div>

                        <div className="auth-benefit">
                            <span className="auth-benefit-icon">
                                <ShieldCheck size={18} />
                            </span>
                            <span>
                                <strong>A workspace built for focus</strong>
                                <small>
                                    Keep your developer workflow clear and organized.
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
                        <SignupBrand />
                    </div>

                    <Link className="auth-back-link" to="/">
                        <ArrowLeft size={14} />
                        Back to homepage
                    </Link>

                    <div className="auth-form-heading">
                        <div className="auth-eyebrow">JOIN THE WORKSPACE</div>

                        <h2>
                            Create your account<span className="auth-gradient-text">.</span>
                        </h2>

                        <p>Start your CoCode journey with a few simple details.</p>
                    </div>

                    <form className="auth-form" onSubmit={handleSubmit}>
                        <div className="auth-field">
                            <label htmlFor="signup-name">Full name</label>

                            <div className="auth-input-wrap">
                                <UserRound size={16} />

                                <input
                                    id="signup-name"
                                    type="text"
                                    autoComplete="name"
                                    placeholder="Enter your name"
                                    value={name}
                                    onChange={(event) => {
                                        setName(event.target.value);
                                        clearMessage();
                                    }}
                                    minLength={2}
                                    maxLength={80}
                                    required
                                />
                            </div>
                        </div>

                        <div className="auth-field">
                            <label htmlFor="signup-email">Email address</label>

                            <div className="auth-input-wrap">
                                <Mail size={16} />

                                <input
                                    id="signup-email"
                                    type="email"
                                    autoComplete="email"
                                    placeholder="you@example.com"
                                    value={email}
                                    onChange={(event) => {
                                        setEmail(event.target.value);
                                        clearMessage();
                                    }}
                                    required
                                />
                            </div>
                        </div>

                        <div className="auth-field">
                            <label htmlFor="signup-password">Password</label>

                            <div className="auth-input-wrap">
                                <LockKeyhole size={16} />

                                <input
                                    id="signup-password"
                                    type={showPassword ? "text" : "password"}
                                    autoComplete="new-password"
                                    placeholder="Create a password"
                                    value={password}
                                    onChange={(event) => {
                                        setPassword(event.target.value);
                                        clearMessage();
                                    }}
                                    minLength={8}
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

                            <small style={{ color: "#8189a8", fontSize: 9 }}>
                                Use at least 8 characters.
                            </small>
                        </div>

                        <div className="auth-field">
                            <label htmlFor="signup-confirm-password">
                                Confirm password
                            </label>

                            <div className="auth-input-wrap">
                                <LockKeyhole size={16} />

                                <input
                                    id="signup-confirm-password"
                                    type={showConfirmPassword ? "text" : "password"}
                                    autoComplete="new-password"
                                    placeholder="Enter your password again"
                                    value={confirmPassword}
                                    onChange={(event) => {
                                        setConfirmPassword(event.target.value);
                                        clearMessage();
                                    }}
                                    required
                                />

                                <button
                                    className="auth-input-action"
                                    type="button"
                                    aria-label={
                                        showConfirmPassword
                                            ? "Hide confirmation password"
                                            : "Show confirmation password"
                                    }
                                    onClick={() =>
                                        setShowConfirmPassword((value) => !value)
                                    }
                                >
                                    {showConfirmPassword ? (
                                        <EyeOff size={16} />
                                    ) : (
                                        <Eye size={16} />
                                    )}
                                </button>
                            </div>
                        </div>

                        <label className="auth-check-label">
                            <input
                                type="checkbox"
                                checked={acceptedTerms}
                                onChange={(event) => {
                                    setAcceptedTerms(event.target.checked);
                                    clearMessage();
                                }}
                            />

                            <span>
                                I agree to the Terms of Service and Privacy Policy.
                            </span>
                        </label>

                        <button className="auth-submit" type="submit" disabled={isSubmitting}>
                            {isSubmitting ? (
                                <>
                                    <LoaderCircle size={16} style={{ animation: "spin 1s linear infinite" }} />
                                    <span>Creating account...</span>
                                </>
                            ) : (
                                <>
                                    <span>Create account</span>
                                    <ArrowRight size={16} />
                                </>
                            )}
                        </button>

                        {message && (
                            <div
                                className={`auth-feedback${isError ? " warning" : ""}`}
                                role="status"
                            >
                                <CheckCircle2 size={16} />
                                <span>{message}</span>
                            </div>
                        )}
                    </form>

                    <div className="auth-divider">OR</div>

                    <Link className="auth-submit" to="/compiler">
                        <Code2 size={16} />
                        Explore the compiler without login
                        <ArrowRight size={16} />
                    </Link>

                    <p className="auth-switch">
                        Already have an account?
                        <Link to="/login">Sign in</Link>
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
