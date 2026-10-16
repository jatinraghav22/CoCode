
import { useState } from "react";
import {
    ArrowLeft,
    ArrowRight,
    CheckCircle2,
    Code2,
    Copy,
    Hash,
    LockKeyhole,
    Plus,
    Sparkles,
    UsersRound,
    Video,
    X,
} from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import "./Room.css";

export default function RoomPage({ mode = "create" }) {
    const isCreate = mode === "create";
    const navigate = useNavigate();

    const [roomName, setRoomName] = useState("My coding room");
    const [displayName, setDisplayName] = useState("Developer");
    const [roomCode, setRoomCode] = useState("");
    const [isPrivate, setIsPrivate] = useState(true);
    const [createdCode, setCreatedCode] = useState("");
    const [message, setMessage] = useState("");
    const [copied, setCopied] = useState(false);

    function createRoom(event) {
        event.preventDefault();
        setMessage("");
        setCopied(false);

        if (roomName.trim().length < 3) {
            setMessage("Room name must contain at least 3 characters.");
            return;
        }

        // Demo-only room code. A backend must create real rooms.
        const code = Math.random().toString(36).slice(2, 8).toUpperCase();
        setCreatedCode(code);
    }

    function joinRoom(event) {
        event.preventDefault();
        setMessage("");

        const normalizedCode = roomCode.trim().toUpperCase();

        if (!/^[A-Z0-9]{6}$/.test(normalizedCode)) {
            setMessage("Enter a room code containing exactly 6 letters or numbers.");
            return;
        }

        setMessage(
            `Code ${normalizedCode} is formatted correctly. Real room joining requires the collaboration backend, which is not connected yet.`
        );
    }

    async function copyRoomCode() {
        try {
            await navigator.clipboard.writeText(createdCode);
            setCopied(true);
            setMessage("Demo room code copied.");
        } catch {
            setCopied(false);
            setMessage("Copy was unavailable. Select and copy the room code manually.");
        }
    }

    return (
        <main className="room-page">
            <header className="room-topbar">
                <Link to="/" className="room-brand" aria-label="CoCode home">
                    <span className="room-brand-mark">C</span>
                    <span>Co<span>Code</span></span>
                </Link>

                <Link to="/dashboard" className="room-back-link">
                    <ArrowLeft size={15} />
                    Dashboard
                </Link>
            </header>

            <section className="room-layout">
                <div className="room-intro">
                    <div className="room-eyebrow">
                        <Sparkles size={14} />
                        BUILD SOMETHING TOGETHER
                    </div>

                    <h1>
                        Great ideas
                        <br />
                        happen <span>together.</span>
                    </h1>

                    <p>
                        Create a space for your next coding session, or join your team
                        using a room code. Your collaboration workspace starts here.
                    </p>

                    <div className="room-benefits">
                        <div>
                            <span className="room-benefit-icon"><UsersRound size={17} /></span>
                            <span>
                                <strong>Team-ready experience</strong>
                                <small>A dedicated flow for coding sessions.</small>
                            </span>
                        </div>
                        <div>
                            <span className="room-benefit-icon"><Code2 size={17} /></span>
                            <span>
                                <strong>Developer-first workspace</strong>
                                <small>Designed around focus and collaboration.</small>
                            </span>
                        </div>
                        <div>
                            <span className="room-benefit-icon"><LockKeyhole size={17} /></span>
                            <span>
                                <strong>Clear access options</strong>
                                <small>Choose a room name and access preference.</small>
                            </span>
                        </div>
                    </div>

                    <div className="room-art" aria-hidden="true">
                        <div className="room-art-ring ring-a" />
                        <div className="room-art-ring ring-b" />
                        <div className="room-art-core">&lt;/&gt;</div>
                        <div className="room-art-node node-a">JS</div>
                        <div className="room-art-node node-b">Py</div>
                        <div className="room-art-node node-c"><UsersRound size={16} /></div>
                    </div>
                </div>

                <div className="room-form-side">
                    <div className="room-form-card">
                        <div className="room-switcher">
                            <Link
                                to="/rooms/create"
                                className={`room-switch-option ${isCreate ? "active" : ""}`}
                            >
                                <Plus size={15} />
                                Create room
                            </Link>
                            <Link
                                to="/rooms/join"
                                className={`room-switch-option ${!isCreate ? "active" : ""}`}
                            >
                                <UsersRound size={15} />
                                Join room
                            </Link>
                        </div>

                        {isCreate ? (
                            <>
                                <div className="room-form-heading">
                                    <div className="room-heading-icon"><Video size={20} /></div>
                                    <h2>Create a room<span>.</span></h2>
                                    <p>Set up a new space for your coding session.</p>
                                </div>

                                {!createdCode ? (
                                    <form className="room-form" onSubmit={createRoom}>
                                        <div className="room-field">
                                            <label htmlFor="room-name">Room name</label>
                                            <input
                                                id="room-name"
                                                type="text"
                                                minLength={3}
                                                maxLength={60}
                                                value={roomName}
                                                onChange={(event) => {
                                                    setRoomName(event.target.value);
                                                    setMessage("");
                                                }}
                                                placeholder="e.g. Hackathon Project"
                                                required
                                            />
                                        </div>

                                        <div className="room-field">
                                            <label htmlFor="room-host">Your display name</label>
                                            <input
                                                id="room-host"
                                                type="text"
                                                maxLength={40}
                                                value={displayName}
                                                onChange={(event) => {
                                                    setDisplayName(event.target.value);
                                                    setMessage("");
                                                }}
                                                placeholder="Enter your display name"
                                                required
                                            />
                                        </div>

                                        <label className="room-private-option">
                                            <span className="room-private-icon"><LockKeyhole size={16} /></span>
                                            <span>
                                                <strong>Private room</strong>
                                                <small>Indicate that the room is intended for invited people.</small>
                                            </span>
                                            <input
                                                type="checkbox"
                                                checked={isPrivate}
                                                onChange={(event) => setIsPrivate(event.target.checked)}
                                            />
                                        </label>

                                        <button className="room-primary-button" type="submit">
                                            <Plus size={16} />
                                            Generate demo room code
                                            <ArrowRight size={16} />
                                        </button>
                                    </form>
                                ) : (
                                    <div className="room-created-state">
                                        <span className="room-success-icon"><CheckCircle2 size={28} /></span>
                                        <h3>Demo room code generated</h3>
                                        <p>
                                            {roomName} · Hosted by {displayName.trim() || "Developer"}
                                        </p>

                                        <div className="room-code-display">
                                            <span>{createdCode}</span>
                                            <button
                                                type="button"
                                                onClick={copyRoomCode}
                                                aria-label="Copy room code"
                                            >
                                                {copied ? <CheckCircle2 size={17} /> : <Copy size={17} />}
                                            </button>
                                        </div>

                                        <div className="room-demo-note">
                                            <LockKeyhole size={15} />
                                            This is a local demo code, not a registered room. Other users cannot join it yet.
                                        </div>

                                        <button
                                            type="button"
                                            className="room-secondary-button"
                                            onClick={() => {
                                                setCreatedCode("");
                                                setMessage("");
                                            }}
                                        >
                                            <Plus size={15} />
                                            Create another demo
                                        </button>
                                    </div>
                                )}
                            </>
                        ) : (
                            <>
                                <div className="room-form-heading">
                                    <div className="room-heading-icon"><Hash size={20} /></div>
                                    <h2>Join a room<span>.</span></h2>
                                    <p>Enter the 6-character code shared by your host.</p>
                                </div>

                                <form className="room-form" onSubmit={joinRoom}>
                                    <div className="room-field">
                                        <label htmlFor="join-room-code">Room code</label>
                                        <input
                                            id="join-room-code"
                                            className="room-code-input"
                                            type="text"
                                            autoCapitalize="characters"
                                            autoComplete="off"
                                            maxLength={6}
                                            value={roomCode}
                                            onChange={(event) => {
                                                setRoomCode(
                                                    event.target.value
                                                        .replace(/[^a-z0-9]/gi, "")
                                                        .slice(0, 6)
                                                        .toUpperCase()
                                                );
                                                setMessage("");
                                            }}
                                            placeholder="ABC123"
                                            required
                                        />
                                        <small>Letters and numbers only.</small>
                                    </div>

                                    <div className="room-field">
                                        <label htmlFor="join-display-name">Your display name</label>
                                        <input
                                            id="join-display-name"
                                            type="text"
                                            maxLength={40}
                                            value={displayName}
                                            onChange={(event) => {
                                                setDisplayName(event.target.value);
                                                setMessage("");
                                            }}
                                            placeholder="Enter your display name"
                                            required
                                        />
                                    </div>

                                    <button className="room-primary-button" type="submit">
                                        <UsersRound size={16} />
                                        Validate room code
                                        <ArrowRight size={16} />
                                    </button>

                                    <div className="room-demo-note">
                                        <LockKeyhole size={15} />
                                        Room membership and live collaboration are not connected yet.
                                    </div>
                                </form>
                            </>
                        )}

                        {message && (
                            <div className="room-feedback" role="status">
                                {message.startsWith("Code ") || message.startsWith("Demo")
                                    ? <CheckCircle2 size={16} />
                                    : <X size={16} />}
                                <span>{message}</span>
                            </div>
                        )}

                        <div className="room-form-footer">
                            <span>Prefer coding solo?</span>
                            <Link to="/compiler">Open public compiler <ArrowRight size={13} /></Link>
                        </div>
                    </div>
                </div>
            </section>

            <footer className="room-footer">
                <span>CoCode <span>·</span> Think clearly. Build boldly.</span>
                <Link to="/dashboard">Back to dashboard ↑</Link>
            </footer>
        </main>
    );
}

