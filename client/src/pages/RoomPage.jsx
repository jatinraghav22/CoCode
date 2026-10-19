import React, { useState } from "react";
import {
    ArrowLeft,
    ArrowRight,
    CheckCircle2,
    Code2,
    Copy,
    Hash,
    LoaderCircle,
    LockKeyhole,
    Plus,
    Sparkles,
    UsersRound,
    Video,
    X,
} from "lucide-react";
import { Link } from "react-router-dom";
import { useAuth } from "../AuthContext.jsx";
import "./Room.css";

const API_BASE = (import.meta.env.VITE_API_URL || "http://localhost:5000").replace(/\/+$/, "");

export default function RoomPage({ mode = "create" }) {
    const isCreate = mode === "create";
    const { token, user } = useAuth();

    const [roomName, setRoomName] = useState("My Collaboration Room");
    const [displayName, setDisplayName] = useState(user?.name || "Developer");
    const [roomCode, setRoomCode] = useState("");
    const [isPrivate, setIsPrivate] = useState(true);
    const [createdRoom, setCreatedRoom] = useState(null);
    const [createdCode, setCreatedCode] = useState("");
    const [message, setMessage] = useState("");
    const [isSuccess, setIsSuccess] = useState(false);
    const [copied, setCopied] = useState(false);
    const [loading, setLoading] = useState(false);

    async function createRoom(event) {
        event.preventDefault();
        setMessage("");
        setCopied(false);
        setIsSuccess(false);

        if (roomName.trim().length < 3) {
            setMessage("Room name must contain at least 3 characters.");
            return;
        }

        setLoading(true);

        try {
            const response = await fetch(`${API_BASE}/api/rooms`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({
                    roomName: roomName.trim(),
                    displayName: displayName.trim(),
                    isPrivate,
                }),
            });

            const data = await response.json();
            if (!response.ok) {
                throw new Error(data.error || "Failed to create room.");
            }

            setCreatedRoom(data.room);
            setCreatedCode(data.room.code);
            setIsSuccess(true);
            setMessage(`Room "${data.room.name}" created successfully on the server.`);
        } catch (error) {
            setMessage(error.message || "Could not connect to the room server.");
            setIsSuccess(false);
        } finally {
            setLoading(false);
        }
    }

    async function joinRoom(event) {
        event.preventDefault();
        setMessage("");
        setIsSuccess(false);

        const normalizedCode = roomCode.trim().toUpperCase();

        if (!/^[A-Z0-9]{6}$/.test(normalizedCode)) {
            setMessage("Enter a room code containing exactly 6 letters or numbers.");
            return;
        }

        setLoading(true);

        try {
            const response = await fetch(`${API_BASE}/api/rooms/join`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({
                    roomCode: normalizedCode,
                    displayName: displayName.trim(),
                }),
            });

            const data = await response.json();
            if (!response.ok) {
                throw new Error(data.error || "Could not join room.");
            }

            setIsSuccess(true);
            setMessage(
                `Successfully joined room "${data.room.name}" (${data.room.code}) hosted by ${data.room.hostName}! Active members: ${data.room.members.join(", ")}`
            );
        } catch (error) {
            setIsSuccess(false);
            setMessage(error.message || "Failed to join room.");
        } finally {
            setLoading(false);
        }
    }

    async function copyRoomCode() {
        try {
            await navigator.clipboard.writeText(createdCode);
            setCopied(true);
            setMessage(`Room code ${createdCode} copied to clipboard!`);
            setIsSuccess(true);
        } catch {
            setCopied(false);
            setMessage("Copy was unavailable. Select and copy the code manually.");
        }
    }

    return (
        <main className="room-page">
            <header className="room-topbar">
                <Link to="/" className="room-brand" aria-label="CoCode home">
                    <span className="room-brand-mark">C</span>
                    <span>Co<span>Code</span></span>
                </Link>

                <div className="room-nav-links">
                    <Link to="/dashboard" className="room-back-link">
                        <ArrowLeft size={15} />
                        Back to Dashboard
                    </Link>
                </div>
            </header>

            <section className="room-layout">
                <div className="room-intro">
                    <div className="room-eyebrow">
                        <Sparkles size={14} />
                        REAL-TIME COLLABORATION
                    </div>

                    <h1>
                        Great ideas
                        <br />
                        happen <span>together.</span>
                    </h1>

                    <p>
                        Create an authorized collaboration room with your team or student,
                        or join an existing session using a verified 6-character room code.
                    </p>

                    <div className="room-benefits">
                        <div>
                            <span className="room-benefit-icon"><UsersRound size={17} /></span>
                            <span>
                                <strong>Authenticated and authorized</strong>
                                <small>Your session token protects room access and ownership.</small>
                            </span>
                        </div>
                        <div>
                            <span className="room-benefit-icon"><Code2 size={17} /></span>
                            <span>
                                <strong>Server-verified room lifecycle</strong>
                                <small>Rooms are registered on the backend with real codes.</small>
                            </span>
                        </div>
                        <div>
                            <span className="room-benefit-icon"><LockKeyhole size={17} /></span>
                            <span>
                                <strong>Privacy controls</strong>
                                <small>Designate private rooms for invited team members only.</small>
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
                                    <p>Set up a verified collaboration space for your coding session.</p>
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
                                                placeholder="e.g. Hackathon Team Room"
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
                                                placeholder="Enter your name"
                                                required
                                            />
                                        </div>

                                        <label className="room-private-option">
                                            <span className="room-private-icon"><LockKeyhole size={16} /></span>
                                            <span>
                                                <strong>Private room</strong>
                                                <small>Indicate that the room is intended for invited peers only.</small>
                                            </span>
                                            <input
                                                type="checkbox"
                                                checked={isPrivate}
                                                onChange={(event) => setIsPrivate(event.target.checked)}
                                            />
                                        </label>

                                        <button className="room-primary-button" type="submit" disabled={loading}>
                                            {loading ? (
                                                <>
                                                    <LoaderCircle size={16} style={{ animation: "spin 1s linear infinite" }} />
                                                    <span>Registering room on server...</span>
                                                </>
                                            ) : (
                                                <>
                                                    <Plus size={16} />
                                                    <span>Create verified room</span>
                                                    <ArrowRight size={16} />
                                                </>
                                            )}
                                        </button>
                                    </form>
                                ) : (
                                    <div className="room-created-state">
                                        <span className="room-success-icon"><CheckCircle2 size={28} /></span>
                                        <h3>Room Created on Server</h3>
                                        <p>
                                            {createdRoom?.name || roomName} · Host: {createdRoom?.hostName || displayName}
                                        </p>

                                        <div className="room-code-display">
                                            <span>{createdCode}</span>
                                            <button
                                                type="button"
                                                onClick={copyRoomCode}
                                                aria-label="Copy room code"
                                                title="Copy Room Code"
                                            >
                                                {copied ? <CheckCircle2 size={17} /> : <Copy size={17} />}
                                            </button>
                                        </div>

                                        <div className="room-demo-note" style={{ background: "rgba(16, 185, 129, 0.1)", borderColor: "rgba(16, 185, 129, 0.3)", color: "#6ee7b7" }}>
                                            <CheckCircle2 size={15} />
                                            Active server room. Teammates can enter code "{createdCode}" in the Join Room tab.
                                        </div>

                                        <div style={{ display: "flex", gap: 10, marginTop: 14 }}>
                                            <Link
                                                to="/compiler"
                                                className="room-primary-button"
                                                style={{ flex: 1, textDecoration: "none" }}
                                            >
                                                <Code2 size={16} />
                                                <span>Open in Compiler</span>
                                            </Link>
                                            <button
                                                type="button"
                                                className="room-secondary-button"
                                                onClick={() => {
                                                    setCreatedCode("");
                                                    setCreatedRoom(null);
                                                    setMessage("");
                                                }}
                                            >
                                                Create another
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </>
                        ) : (
                            <>
                                <div className="room-form-heading">
                                    <div className="room-heading-icon"><Hash size={20} /></div>
                                    <h2>Join a room<span>.</span></h2>
                                    <p>Enter the 6-character code registered by your host.</p>
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
                                            placeholder="e.g. DEMO01"
                                            required
                                        />
                                        <small>Tip: Try the active seeded demo room <code>DEMO01</code>.</small>
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
                                            placeholder="Enter your name"
                                            required
                                        />
                                    </div>

                                    <button className="room-primary-button" type="submit" disabled={loading}>
                                        {loading ? (
                                            <>
                                                <LoaderCircle size={16} style={{ animation: "spin 1s linear infinite" }} />
                                                <span>Verifying code with server...</span>
                                            </>
                                        ) : (
                                            <>
                                                <UsersRound size={16} />
                                                <span>Join verified room</span>
                                                <ArrowRight size={16} />
                                            </>
                                        )}
                                    </button>
                                </form>
                            </>
                        )}

                        {message && (
                            <div
                                className="room-feedback"
                                role="status"
                                style={
                                    isSuccess
                                        ? { borderColor: "rgba(16, 185, 129, 0.4)", color: "#6ee7b7" }
                                        : { borderColor: "rgba(244, 63, 94, 0.4)", color: "#fca5a5" }
                                }
                            >
                                {isSuccess ? (
                                    <CheckCircle2 size={16} style={{ color: "#10b981", flexShrink: 0 }} />
                                ) : (
                                    <X size={16} style={{ color: "#f43f5e", flexShrink: 0 }} />
                                )}
                                <span>{message}</span>
                            </div>
                        )}

                        <div className="room-form-footer">
                            <span>Prefer solo coding?</span>
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
