import React, { useState, useEffect, useRef, useMemo } from "react";
import { useParams, useSearchParams, Link } from "react-router-dom";
import Editor from "@monaco-editor/react";
import JSZip from "jszip";
import { io } from "socket.io-client";
import {
  Files,
  Search,
  History,
  Play,
  Square,
  Sparkles,
  MessageSquare,
  TrendingUp,
  Users,
  Settings,
  Wrench,
  FilePlus,
  FolderPlus,
  Upload,
  FolderUp,
  FileUp,
  Download,
  X,
  Plus,
  ChevronRight,
  ChevronDown,
  Trash2,
  Edit2,
  Copy,
  Terminal,
  Send,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  RefreshCw,
  Folder,
  FileCode,
  FileText,
  Sliders,
  Share2
} from "lucide-react";
import { useAuth } from "../AuthContext.jsx";
import "./EditorPage.css";

const API_BASE = (import.meta.env.VITE_API_URL || "http://localhost:5000").replace(/\/+$/, "");

// Starter project files matching reference
const DEFAULT_FILES = [
  {
    id: "f-1",
    name: "index.js",
    path: "/index.js",
    language: "javascript",
    content: `function sayHi() {\n    console.log("Hello world");\n}\n\nsayHi();\n`,
    isFolder: false,
  },
  {
    id: "f-2",
    name: "styles.css",
    path: "/styles.css",
    language: "css",
    content: `body {\n    background: #0f172a;\n    color: #f8fafc;\n    font-family: sans-serif;\n}\n`,
    isFolder: false,
  },
  {
    id: "f-3",
    name: "main.py",
    path: "/main.py",
    language: "python",
    content: `# Welcome to CoCode\ndef greet(name):\n    return f"Hello, {name}!"\n\nprint(greet("Developer"))\n`,
    isFolder: false,
  },
  {
    id: "f-4",
    name: "src",
    path: "/src",
    isFolder: true,
  },
  {
    id: "f-5",
    name: "app.js",
    path: "/src/app.js",
    language: "javascript",
    content: `console.log("CoCode modular app initialized.");\n`,
    isFolder: false,
  }
];

export default function EditorPage() {
  const { roomId } = useParams();
  const [searchParams] = useSearchParams();
  const { user, token } = useAuth();

  // Active activity bar tab: files | search | history | run | ai | chat | analytics | teams | settings | devtools
  const [activeActivityTab, setActiveActivityTab] = useState("files");

  // Files & Folders state
  const projectStorageKey = useMemo(() => `cocode-ide-files-${roomId || "default"}`, [roomId]);
  const [files, setFiles] = useState(() => {
    try {
      const saved = localStorage.getItem(projectStorageKey);
      if (saved) return JSON.parse(saved);
    } catch {}
    return DEFAULT_FILES;
  });

  // Open Editor tabs
  const [openTabIds, setOpenTabIds] = useState(["f-1"]);
  const [activeFileId, setActiveFileId] = useState("f-1");
  const [dirtyFiles, setDirtyFiles] = useState({}); // { [fileId]: true }

  // Folder collapse state
  const [expandedFolders, setExpandedFolders] = useState({ "/src": true });

  // Inline rename / new file creation state
  const [renamingId, setRenamingId] = useState(null);
  const [renameValue, setRenameValue] = useState("");
  const [newFileInput, setNewFileInput] = useState(null); // { parentPath: string, isFolder: boolean }
  const [newItemName, setNewItemName] = useState("");

  // Editor Settings state
  const [editorSettings, setEditorSettings] = useState({
    theme: "cocode-dark",
    fontSize: 14,
    tabSize: 4,
    wordWrap: "on",
    minimap: true,
    lineNumbers: "on",
    autoSave: true,
  });

  // Bottom Panel State (Output, Terminal, Stdin, Problems, History)
  const [bottomPanelTab, setBottomPanelTab] = useState("output");
  const [bottomPanelHeight, setBottomPanelHeight] = useState(200);
  const [isBottomPanelCollapsed, setIsBottomPanelCollapsed] = useState(false);
  const [stdinValue, setStdinValue] = useState("");
  const [isExecuting, setIsExecuting] = useState(false);
  const [executionOutput, setExecutionOutput] = useState({
    stdout: 'Hello world\n',
    stderr: '',
    compileOutput: '',
    status: 'Finished',
    time: 0.024,
    memory: 14200,
  });
  const [executionHistory, setExecutionHistory] = useState([
    {
      id: "run-1",
      timestamp: Date.now() - 60000,
      language: "javascript",
      status: "Success",
      time: "0.024s",
      output: "Hello world",
    }
  ]);

  // Version History state
  const [fileRevisions, setFileRevisions] = useState([
    {
      id: "rev-init",
      fileId: "f-1",
      filename: "index.js",
      timestamp: Date.now() - 3600000,
      content: DEFAULT_FILES[0].content,
      author: user?.name || "Developer",
    }
  ]);

  // Global Search state
  const [searchQuery, setSearchQuery] = useState("");
  const [matchCase, setMatchCase] = useState(false);

  // AI Assistant state
  const [aiPrompt, setAiPrompt] = useState("");
  const [aiResponse, setAiResponse] = useState("");
  const [aiLoading, setAiLoading] = useState(false);

  // Chat & Real-Time Collaboration state
  const [chatMessages, setChatMessages] = useState([
    {
      id: "msg-1",
      senderId: "system",
      senderName: "CoCode Bot",
      text: `Connected to IDE session ${roomId ? `[Room: ${roomId}]` : "(Local Project)"}.`,
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    }
  ]);
  const [chatInput, setChatInput] = useState("");
  const [collaborators, setCollaborators] = useState([
    { id: user?.id || "u-current", name: user?.name || "Jatin Raghav", role: "Host", online: true }
  ]);

  const editorRef = useRef(null);
  const socketRef = useRef(null);
  const isResizingRef = useRef(false);

  // Get active file object
  const activeFile = useMemo(() => {
    return files.find((f) => f.id === activeFileId) || files.find((f) => !f.isFolder) || null;
  }, [files, activeFileId]);

  // Save files to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(projectStorageKey, JSON.stringify(files));
    } catch {}
  }, [files, projectStorageKey]);

  // Initialize Socket.IO connection for real-time room collaboration
  useEffect(() => {
    if (!roomId) return;
    try {
      const socket = io(API_BASE, {
        auth: { token },
        transports: ["websocket", "polling"],
      });
      socketRef.current = socket;

      socket.emit("join-room", {
        roomCode: roomId,
        displayName: user?.name || "Developer",
      });

      socket.on("room-update", (data) => {
        if (data.members) {
          setCollaborators(
            data.members.map((m, idx) => ({
              id: `collab-${idx}`,
              name: typeof m === "string" ? m : m.name,
              role: idx === 0 ? "Host" : "Member",
              online: true,
            }))
          );
        }
      });

      socket.on("code-change", (data) => {
        if (data.fileId && data.content !== undefined) {
          setFiles((prev) =>
            prev.map((f) => (f.id === data.fileId ? { ...f, content: data.content } : f))
          );
        }
      });

      socket.on("chat-message", (msg) => {
        setChatMessages((prev) => [...prev, msg]);
      });

      return () => {
        socket.disconnect();
      };
    } catch (err) {
      console.warn("Socket.IO connection failed:", err);
    }
  }, [roomId, token, user]);

  // Setup custom dark Monaco theme
  function handleEditorWillMount(monaco) {
    monaco.editor.defineTheme("cocode-dark", {
      base: "vs-dark",
      inherit: true,
      rules: [
        { token: "keyword", foreground: "f43f5e", fontStyle: "bold" },
        { token: "identifier", foreground: "4ade80" },
        { token: "string", foreground: "facc15" },
        { token: "comment", foreground: "64748b", fontStyle: "italic" },
        { token: "number", foreground: "38bdf8" },
        { token: "delimiter", foreground: "f8fafc" },
        { token: "type", foreground: "a855f7" },
      ],
      colors: {
        "editor.background": "#111622",
        "editor.foreground": "#e2e8f0",
        "editor.lineHighlightBackground": "#172033",
        "editorLineNumber.foreground": "#475569",
        "editorLineNumber.activeForeground": "#38bdf8",
        "editorCursor.foreground": "#38bdf8",
        "editor.selectionBackground": "#1e3a5f",
        "editor.inactiveSelectionBackground": "#152a45",
      },
    });
  }

  function handleEditorDidMount(editor) {
    editorRef.current = editor;
  }

  // Handle Code Change
  function handleCodeChange(newContent) {
    if (!activeFile) return;
    const content = newContent || "";

    setFiles((prev) =>
      prev.map((f) => (f.id === activeFile.id ? { ...f, content } : f))
    );

    setDirtyFiles((prev) => ({ ...prev, [activeFile.id]: true }));

    // Real-time broadcast if in room
    if (socketRef.current && roomId) {
      socketRef.current.emit("code-change", {
        roomCode: roomId,
        fileId: activeFile.id,
        content,
      });
    }
  }

  // Save current file revision
  function saveCurrentFile() {
    if (!activeFile) return;
    setDirtyFiles((prev) => {
      const next = { ...prev };
      delete next[activeFile.id];
      return next;
    });

    const newRev = {
      id: `rev-${Date.now()}`,
      fileId: activeFile.id,
      filename: activeFile.name,
      timestamp: Date.now(),
      content: activeFile.content || "",
      author: user?.name || "Developer",
    };
    setFileRevisions((prev) => [newRev, ...prev]);
  }

  // Tab management
  function openFile(file) {
    if (file.isFolder) {
      toggleFolder(file.path);
      return;
    }
    if (!openTabIds.includes(file.id)) {
      setOpenTabIds((prev) => [...prev, file.id]);
    }
    setActiveFileId(file.id);
  }

  function closeTab(e, tabId) {
    e.stopPropagation();
    const remaining = openTabIds.filter((id) => id !== tabId);
    setOpenTabIds(remaining);
    if (activeFileId === tabId) {
      setActiveFileId(remaining[remaining.length - 1] || null);
    }
  }

  function toggleFolder(path) {
    setExpandedFolders((prev) => ({
      ...prev,
      [path]: !prev[path],
    }));
  }

  // Create new file or folder
  function handleCreateItem() {
    if (!newItemName.trim()) {
      setNewFileInput(null);
      return;
    }
    const cleanName = newItemName.trim();
    const parentPath = newFileInput?.parentPath || "";
    const path = `${parentPath}/${cleanName}`.replace(/\/+/g, "/");

    // Detect language from extension
    let language = "javascript";
    if (cleanName.endsWith(".py")) language = "python";
    else if (cleanName.endsWith(".cpp") || cleanName.endsWith(".cc")) language = "cpp";
    else if (cleanName.endsWith(".c")) language = "c";
    else if (cleanName.endsWith(".html")) language = "html";
    else if (cleanName.endsWith(".css")) language = "css";
    else if (cleanName.endsWith(".json")) language = "json";

    const newItem = {
      id: `f-${Date.now()}`,
      name: cleanName,
      path,
      isFolder: Boolean(newFileInput?.isFolder),
      language,
      content: newFileInput?.isFolder ? undefined : "",
    };

    setFiles((prev) => [...prev, newItem]);
    if (!newItem.isFolder) {
      setOpenTabIds((prev) => [...prev, newItem.id]);
      setActiveFileId(newItem.id);
    }
    setNewFileInput(null);
    setNewItemName("");
  }

  // Delete file or folder
  function handleDeleteItem(item, e) {
    e.stopPropagation();
    if (!window.confirm(`Are you sure you want to delete "${item.name}"?`)) return;

    setFiles((prev) =>
      prev.filter((f) => f.id !== item.id && !f.path.startsWith(`${item.path}/`))
    );
    setOpenTabIds((prev) => prev.filter((id) => id !== item.id));
    if (activeFileId === item.id) {
      setActiveFileId(null);
    }
  }

  // Rename item
  function handleRenameItem(item, e) {
    e.stopPropagation();
    setRenamingId(item.id);
    setRenameValue(item.name);
  }

  function submitRename(item) {
    if (renameValue.trim() && renameValue.trim() !== item.name) {
      const newName = renameValue.trim();
      const parent = item.path.substring(0, item.path.lastIndexOf("/"));
      const newPath = `${parent}/${newName}`.replace(/\/+/g, "/");

      setFiles((prev) =>
        prev.map((f) => {
          if (f.id === item.id) {
            return { ...f, name: newName, path: newPath };
          }
          if (f.path.startsWith(`${item.path}/`)) {
            return { ...f, path: f.path.replace(item.path, newPath) };
          }
          return f;
        })
      );
    }
    setRenamingId(null);
  }

  // Upload Files handler
  function handleUploadFiles(e) {
    const uploadedFiles = Array.from(e.target.files || []);
    if (!uploadedFiles.length) return;

    uploadedFiles.forEach((file) => {
      const reader = new FileReader();
      reader.onload = (event) => {
        const content = event.target.result;
        let language = "javascript";
        if (file.name.endsWith(".py")) language = "python";
        else if (file.name.endsWith(".cpp")) language = "cpp";
        else if (file.name.endsWith(".html")) language = "html";
        else if (file.name.endsWith(".css")) language = "css";
        else if (file.name.endsWith(".json")) language = "json";

        const newF = {
          id: `upload-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          name: file.name,
          path: `/${file.name}`,
          language,
          content,
          isFolder: false,
        };
        setFiles((prev) => [...prev, newF]);
        setOpenTabIds((prev) => [...prev, newF.id]);
        setActiveFileId(newF.id);
      };
      reader.readAsText(file);
    });
  }

  // Download complete project as ZIP archive using JSZip
  async function handleDownloadCode() {
    const zip = new JSZip();
    files.forEach((f) => {
      if (!f.isFolder) {
        const cleanPath = f.path.replace(/^\/+/, "");
        zip.file(cleanPath, f.content || "");
      }
    });

    const blob = await zip.generateAsync({ type: "blob" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `cocode-project-${roomId || "workspace"}.zip`;
    link.click();
    URL.revokeObjectURL(link.href);
  }

  // Execute Code via backend Judge0 compiler API
  async function handleRunCode() {
    if (!activeFile) return;
    setIsExecuting(true);
    setBottomPanelTab("output");
    setIsBottomPanelCollapsed(false);

    try {
      const response = await fetch(`${API_BASE}/api/compiler/run`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: token ? `Bearer ${token}` : "",
        },
        body: JSON.stringify({
          sourceCode: activeFile.content || "",
          language: activeFile.language || "javascript",
          stdin: stdinValue,
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Execution failed.");
      }

      setExecutionOutput({
        stdout: data.stdout || "",
        stderr: data.stderr || "",
        compileOutput: data.compileOutput || "",
        status: data.status || "Finished",
        time: data.time || 0.02,
        memory: data.memory || 12000,
      });

      setExecutionHistory((prev) => [
        {
          id: `run-${Date.now()}`,
          timestamp: Date.now(),
          language: activeFile.language,
          status: data.status || "Finished",
          time: `${data.time || 0.02}s`,
          output: data.stdout || data.stderr || data.compileOutput || "Finished with no output",
        },
        ...prev,
      ]);
    } catch (err) {
      setExecutionOutput({
        stdout: "",
        stderr: err.message || "An execution error occurred.",
        compileOutput: "",
        status: "Error",
        time: null,
        memory: null,
      });
    } finally {
      setIsExecuting(false);
    }
  }

  // AI Assistant action
  async function handleAiAssist(actionType, extraPrompt = "") {
    if (!activeFile) return;
    setAiLoading(true);
    setActiveActivityTab("ai");

    const promptText = extraPrompt || aiPrompt || `Explain the following ${activeFile.language} code:\n\n${activeFile.content}`;

    try {
      const res = await fetch(`${API_BASE}/api/ai/assist`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: token ? `Bearer ${token}` : "",
        },
        body: JSON.stringify({
          action: actionType,
          language: activeFile.language,
          code: activeFile.content,
          prompt: promptText,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "AI service unavailable.");
      setAiResponse(data.reply || data.output || "AI response generated successfully.");
    } catch (err) {
      // Graceful informative fallback
      setAiResponse(
        `💡 AI Assistant (${actionType}):\n` +
        `This file is written in ${activeFile.language.toUpperCase()}.\n` +
        `Key components detected: functions and standard log routines.\n\n` +
        `To enable live AI inference with OpenAI/Gemini, set AI_API_KEY in server/.env.`
      );
    } finally {
      setAiLoading(false);
    }
  }

  // Chat message send
  function handleSendMessage(e) {
    e.preventDefault();
    if (!chatInput.trim()) return;

    const newMsg = {
      id: `msg-${Date.now()}`,
      senderId: user?.id || "u-current",
      senderName: user?.name || "Jatin Raghav",
      text: chatInput.trim(),
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    };

    setChatMessages((prev) => [...prev, newMsg]);
    setChatInput("");

    if (socketRef.current && roomId) {
      socketRef.current.emit("chat-message", {
        roomCode: roomId,
        message: newMsg,
      });
    }
  }

  // Global search filtering
  const searchResults = useMemo(() => {
    if (!searchQuery.trim()) return [];
    const query = matchCase ? searchQuery : searchQuery.toLowerCase();
    const results = [];

    files.forEach((f) => {
      if (f.isFolder) return;
      const content = f.content || "";
      const lines = content.split("\n");
      lines.forEach((line, lineIdx) => {
        const lineText = matchCase ? line : line.toLowerCase();
        if (lineText.includes(query)) {
          results.push({
            file: f,
            lineNumber: lineIdx + 1,
            lineText: line.trim(),
          });
        }
      });
    });

    return results;
  }, [files, searchQuery, matchCase]);

  // Language icon badge helper
  function renderLanguageBadge(lang) {
    const l = (lang || "").toLowerCase();
    if (l === "javascript" || l === "js") return <span className="ide-file-badge badge-js">JS</span>;
    if (l === "python" || l === "py") return <span className="ide-file-badge badge-py">PY</span>;
    if (l === "cpp" || l === "c++") return <span className="ide-file-badge badge-cpp">C++</span>;
    if (l === "c") return <span className="ide-file-badge badge-c">C</span>;
    if (l === "html") return <span className="ide-file-badge badge-html">HTML</span>;
    if (l === "css") return <span className="ide-file-badge badge-css">CSS</span>;
    if (l === "json") return <span className="ide-file-badge badge-json">JSON</span>;
    return <span className="ide-file-badge badge-generic">DOC</span>;
  }

  return (
    <div className="ide-root">
      {/* ======================================================================
          Top Application Toolbar
      ====================================================================== */}
      <header className="ide-topbar">
        <div className="ide-topbar-left">
          <Link to="/dashboard" className="ide-brand" title="CoCode Dashboard">
            <span className="ide-brand-badge">C</span>
            <span>CoCode</span>
          </Link>
          <div className="ide-project-title-badge">
            <span>Project:</span>
            <strong>{roomId ? `Room ${roomId}` : "Default Workspace"}</strong>
          </div>
          {roomId && (
            <div className="ide-collab-badge">
              <span className="ide-collab-dot" />
              <span>{collaborators.length} Online</span>
            </div>
          )}
        </div>

        <div className="ide-topbar-center">
          {activeFile && (
            <div className="ide-project-title-badge">
              {renderLanguageBadge(activeFile.language)}
              <span>{activeFile.name}</span>
            </div>
          )}
        </div>

        <div className="ide-topbar-right">
          {isExecuting ? (
            <button className="ide-btn-header-stop" onClick={() => setIsExecuting(false)}>
              <Square size={13} fill="currentColor" />
              <span>Stop</span>
            </button>
          ) : (
            <button className="ide-btn-header-run" onClick={handleRunCode} title="Run current code (Ctrl+Enter)">
              <Play size={13} fill="currentColor" />
              <span>Run Code</span>
            </button>
          )}

          <button className="ide-btn-header-secondary" onClick={saveCurrentFile} title="Save File (Ctrl+S)">
            <span>{dirtyFiles[activeFileId] ? "● Save" : "Saved"}</span>
          </button>

          <button
            className="ide-btn-header-secondary"
            onClick={() => setActiveActivityTab("teams")}
            title="Share Room"
          >
            <Share2 size={13} />
            <span>Share</span>
          </button>
        </div>
      </header>

      {/* ======================================================================
          Main Body (Activity Bar + Sidebar + Main Surface)
      ====================================================================== */}
      <div className="ide-body">
        {/* Activity Bar (Far Left, 52px) */}
        <aside className="ide-activity-bar">
          <div className="ide-activity-group">
            <button
              className={`ide-activity-btn ${activeActivityTab === "files" ? "active" : ""}`}
              onClick={() => setActiveActivityTab(activeActivityTab === "files" ? null : "files")}
              title="File Explorer (Ctrl+Shift+E)"
            >
              <Files size={20} />
            </button>
            <button
              className={`ide-activity-btn ${activeActivityTab === "search" ? "active" : ""}`}
              onClick={() => setActiveActivityTab(activeActivityTab === "search" ? null : "search")}
              title="Global Search (Ctrl+Shift+F)"
            >
              <Search size={20} />
            </button>
            <button
              className={`ide-activity-btn ${activeActivityTab === "history" ? "active" : ""}`}
              onClick={() => setActiveActivityTab(activeActivityTab === "history" ? null : "history")}
              title="Code History & Revisions"
            >
              <History size={20} />
            </button>
            <button
              className={`ide-activity-btn ${activeActivityTab === "run" ? "active" : ""}`}
              onClick={() => {
                setActiveActivityTab("run");
                handleRunCode();
              }}
              title="Run / Output Panel"
            >
              <Play size={20} />
            </button>
            <button
              className={`ide-activity-btn ${activeActivityTab === "ai" ? "active" : ""}`}
              onClick={() => setActiveActivityTab(activeActivityTab === "ai" ? null : "ai")}
              title="AI Coding Assistant"
            >
              <Sparkles size={20} />
            </button>
            <button
              className={`ide-activity-btn ${activeActivityTab === "chat" ? "active" : ""}`}
              onClick={() => setActiveActivityTab(activeActivityTab === "chat" ? null : "chat")}
              title="Chat & Messages"
            >
              <MessageSquare size={20} />
              {chatMessages.length > 1 && <span className="badge-counter">{chatMessages.length}</span>}
            </button>
            <button
              className={`ide-activity-btn ${activeActivityTab === "analytics" ? "active" : ""}`}
              onClick={() => setActiveActivityTab(activeActivityTab === "analytics" ? null : "analytics")}
              title="Activity Analytics"
            >
              <TrendingUp size={20} />
            </button>
            <button
              className={`ide-activity-btn ${activeActivityTab === "teams" ? "active" : ""}`}
              onClick={() => setActiveActivityTab(activeActivityTab === "teams" ? null : "teams")}
              title="Teams & Collaborators"
            >
              <Users size={20} />
              <span className="badge-counter">{collaborators.length}</span>
            </button>
          </div>

          <div className="ide-activity-group">
            <button
              className={`ide-activity-btn ${activeActivityTab === "settings" ? "active" : ""}`}
              onClick={() => setActiveActivityTab(activeActivityTab === "settings" ? null : "settings")}
              title="Editor Settings"
            >
              <Settings size={20} />
            </button>
            <button
              className={`ide-activity-btn ${activeActivityTab === "devtools" ? "active" : ""}`}
              onClick={() => setActiveActivityTab(activeActivityTab === "devtools" ? null : "devtools")}
              title="Developer Tools"
            >
              <Wrench size={20} />
            </button>
          </div>
        </aside>

        {/* Sidebar Panel (Toggles with activeActivityTab) */}
        {activeActivityTab && (
          <aside className="ide-sidebar">
            {/* Panel 1: File Explorer */}
            {activeActivityTab === "files" && (
              <>
                <div className="ide-sidebar-header">
                  <span className="ide-sidebar-title">Files</span>
                  <div className="ide-sidebar-actions">
                    <button
                      className="ide-icon-btn"
                      onClick={() => setNewFileInput({ parentPath: "", isFolder: false })}
                      title="New File"
                    >
                      <FilePlus size={16} />
                    </button>
                    <button
                      className="ide-icon-btn"
                      onClick={() => setNewFileInput({ parentPath: "", isFolder: true })}
                      title="New Folder"
                    >
                      <FolderPlus size={16} />
                    </button>
                    <button
                      className="ide-icon-btn"
                      onClick={() => setFiles([...DEFAULT_FILES])}
                      title="Reset Files to Sample"
                    >
                      <RefreshCw size={14} />
                    </button>
                  </div>
                </div>

                <div className="ide-sidebar-content">
                  {/* Inline New File/Folder Input */}
                  {newFileInput && (
                    <div style={{ padding: "4px 8px" }}>
                      <input
                        autoFocus
                        className="ide-tree-rename-input"
                        placeholder={newFileInput.isFolder ? "Folder name..." : "File name (e.g. app.js)..."}
                        value={newItemName}
                        onChange={(e) => setNewItemName(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") handleCreateItem();
                          if (e.key === "Escape") setNewFileInput(null);
                        }}
                        onBlur={handleCreateItem}
                      />
                    </div>
                  )}

                  {/* Render files and folders */}
                  {files.map((item) => {
                    if (item.isFolder) {
                      const isExpanded = expandedFolders[item.path];
                      return (
                        <div
                          key={item.id}
                          className="ide-tree-item"
                          onClick={() => toggleFolder(item.path)}
                        >
                          {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                          <Folder size={15} color="#38bdf8" />
                          <span>{item.name}</span>
                          <div className="ide-tree-item-actions">
                            <button
                              className="ide-tree-action-btn"
                              onClick={(e) => handleDeleteItem(item, e)}
                              title="Delete Folder"
                            >
                              <Trash2 size={13} />
                            </button>
                          </div>
                        </div>
                      );
                    }

                    const isRenaming = renamingId === item.id;
                    return (
                      <div
                        key={item.id}
                        className={`ide-tree-item ${activeFileId === item.id ? "active" : ""}`}
                        onClick={() => openFile(item)}
                      >
                        {renderLanguageBadge(item.language)}
                        {isRenaming ? (
                          <input
                            autoFocus
                            className="ide-tree-rename-input"
                            value={renameValue}
                            onChange={(e) => setRenameValue(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") submitRename(item);
                              if (e.key === "Escape") setRenamingId(null);
                            }}
                            onBlur={() => submitRename(item)}
                          />
                        ) : (
                          <span>{item.name}</span>
                        )}

                        <div className="ide-tree-item-actions">
                          <button
                            className="ide-tree-action-btn"
                            onClick={(e) => handleRenameItem(item, e)}
                            title="Rename"
                          >
                            <Edit2 size={12} />
                          </button>
                          <button
                            className="ide-tree-action-btn"
                            onClick={(e) => handleDeleteItem(item, e)}
                            title="Delete"
                          >
                            <Trash2 size={12} />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Bottom 3 Pill Buttons (Screenshot Match: Upload Folder, Upload Files, Download Code) */}
                <div className="ide-sidebar-bottom-actions">
                  <label className="ide-pill-action-btn" style={{ cursor: "pointer" }}>
                    <FolderUp size={16} />
                    <span>Upload Folder</span>
                    <input
                      type="file"
                      webkitdirectory="true"
                      directory="true"
                      multiple
                      onChange={handleUploadFiles}
                      style={{ display: "none" }}
                    />
                  </label>

                  <label className="ide-pill-action-btn" style={{ cursor: "pointer" }}>
                    <FileUp size={16} />
                    <span>Upload Files</span>
                    <input
                      type="file"
                      multiple
                      onChange={handleUploadFiles}
                      style={{ display: "none" }}
                    />
                  </label>

                  <button className="ide-pill-action-btn" onClick={handleDownloadCode}>
                    <Download size={16} />
                    <span>Download Code</span>
                  </button>
                </div>
              </>
            )}

            {/* Panel 2: Global Search */}
            {activeActivityTab === "search" && (
              <div className="ide-panel-view">
                <div className="ide-panel-heading">
                  <Search size={16} color="#38bdf8" />
                  <span>Search in Project</span>
                </div>
                <div className="ide-form-group">
                  <input
                    className="ide-input-text"
                    placeholder="Search query..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                  <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, color: "#94a3b8" }}>
                    <input
                      type="checkbox"
                      checked={matchCase}
                      onChange={(e) => setMatchCase(e.target.checked)}
                    />
                    Match Case
                  </label>
                </div>

                <div style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", gap: 6 }}>
                  {searchResults.length === 0 && searchQuery ? (
                    <div style={{ color: "#64748b", fontSize: 12 }}>No matches found.</div>
                  ) : (
                    searchResults.map((res, i) => (
                      <div
                        key={i}
                        className="ide-tree-item"
                        style={{ flexDirection: "column", alignItems: "flex-start", gap: 2 }}
                        onClick={() => {
                          openFile(res.file);
                          if (editorRef.current) {
                            editorRef.current.revealLineInCenter(res.lineNumber);
                            editorRef.current.setPosition({ lineNumber: res.lineNumber, column: 1 });
                          }
                        }}
                      >
                        <div style={{ display: "flex", gap: 6, alignItems: "center", width: "100%" }}>
                          <span style={{ color: "#38bdf8", fontWeight: 600 }}>{res.file.name}</span>
                          <span style={{ color: "#64748b", fontSize: 11 }}>:{res.lineNumber}</span>
                        </div>
                        <div style={{ color: "#cbd5e1", fontSize: 11, fontFamily: "monospace" }}>
                          {res.lineText}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}

            {/* Panel 3: Code History */}
            {activeActivityTab === "history" && (
              <div className="ide-panel-view">
                <div className="ide-panel-heading">
                  <History size={16} color="#38bdf8" />
                  <span>Version Snapshots</span>
                </div>
                <button
                  className="ide-pill-action-btn"
                  style={{ marginBottom: 12 }}
                  onClick={saveCurrentFile}
                >
                  <Plus size={14} />
                  <span>Record Current Revision</span>
                </button>

                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {fileRevisions.map((rev) => (
                    <div
                      key={rev.id}
                      style={{
                        background: "#111827",
                        border: "1px solid #1f293d",
                        borderRadius: 6,
                        padding: 10,
                        fontSize: 12,
                      }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", color: "#94a3b8", fontSize: 10 }}>
                        <span>{new Date(rev.timestamp).toLocaleTimeString()}</span>
                        <span>{rev.author}</span>
                      </div>
                      <div style={{ fontWeight: 600, color: "#f8fafc", margin: "4px 0" }}>
                        {rev.filename}
                      </div>
                      <button
                        style={{
                          background: "#1e293b",
                          border: "none",
                          color: "#38bdf8",
                          borderRadius: 4,
                          padding: "3px 8px",
                          fontSize: 11,
                          cursor: "pointer",
                          marginTop: 4,
                        }}
                        onClick={() => {
                          if (window.confirm(`Restore revision from ${new Date(rev.timestamp).toLocaleTimeString()}?`)) {
                            handleCodeChange(rev.content);
                          }
                        }}
                      >
                        Restore Version
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Panel 4: AI Coding Assistant */}
            {activeActivityTab === "ai" && (
              <div className="ide-panel-view">
                <div className="ide-panel-heading">
                  <Sparkles size={16} color="#38bdf8" />
                  <span>AI Assistant</span>
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 14 }}>
                  <button
                    className="ide-ai-quick-btn"
                    onClick={() => handleAiAssist("explain", "Explain this code in detail")}
                  >
                    <span>💡 Explain Current File</span>
                  </button>
                  <button
                    className="ide-ai-quick-btn"
                    onClick={() => handleAiAssist("fix", "Suggest fixes for potential errors or bugs")}
                  >
                    <span>🔧 Suggest Error Fixes</span>
                  </button>
                  <button
                    className="ide-ai-quick-btn"
                    onClick={() => handleAiAssist("refactor", "Refactor this code for readability and performance")}
                  >
                    <span>⚡ Refactor & Clean Code</span>
                  </button>
                </div>

                <div className="ide-form-group">
                  <textarea
                    className="ide-input-text"
                    style={{ minHeight: 60, resize: "vertical" }}
                    placeholder="Ask AI anything about your code..."
                    value={aiPrompt}
                    onChange={(e) => setAiPrompt(e.target.value)}
                  />
                  <button
                    className="ide-pill-action-btn"
                    style={{ justifyContent: "center" }}
                    disabled={aiLoading}
                    onClick={() => handleAiAssist("prompt")}
                  >
                    <Sparkles size={14} />
                    <span>{aiLoading ? "Generating..." : "Ask Assistant"}</span>
                  </button>
                </div>

                {aiResponse && (
                  <div className="ide-ai-response-box">
                    <pre style={{ margin: 0, whiteSpace: "pre-wrap" }}>{aiResponse}</pre>
                  </div>
                )}
              </div>
            )}

            {/* Panel 5: Real-time Room Chat */}
            {activeActivityTab === "chat" && (
              <div className="ide-panel-view">
                <div className="ide-panel-heading">
                  <MessageSquare size={16} color="#38bdf8" />
                  <span>Team Chat</span>
                </div>

                <div className="ide-chat-list">
                  {chatMessages.map((msg) => {
                    const isMine = msg.senderId === (user?.id || "u-current");
                    return (
                      <div key={msg.id} className={`ide-chat-msg ${isMine ? "mine" : "theirs"}`}>
                        <div className="ide-chat-msg-header">
                          <strong>{msg.senderName}</strong>
                          <span>{msg.timestamp}</span>
                        </div>
                        <div>{msg.text}</div>
                      </div>
                    );
                  })}
                </div>

                <form className="ide-chat-input-bar" onSubmit={handleSendMessage}>
                  <input
                    className="ide-input-text"
                    style={{ flex: 1 }}
                    placeholder="Type a message..."
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                  />
                  <button type="submit" className="ide-icon-btn" style={{ background: "#2563eb", color: "#fff" }}>
                    <Send size={14} />
                  </button>
                </form>
              </div>
            )}

            {/* Panel 6: Activity Analytics */}
            {activeActivityTab === "analytics" && (
              <div className="ide-panel-view">
                <div className="ide-panel-heading">
                  <TrendingUp size={16} color="#38bdf8" />
                  <span>Activity Analytics</span>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 14 }}>
                  <div style={{ background: "#111827", padding: 10, borderRadius: 6 }}>
                    <div style={{ color: "#94a3b8", fontSize: 10 }}>PROJECT FILES</div>
                    <div style={{ fontSize: 18, fontWeight: 700, color: "#38bdf8" }}>{files.length}</div>
                  </div>
                  <div style={{ background: "#111827", padding: 10, borderRadius: 6 }}>
                    <div style={{ color: "#94a3b8", fontSize: 10 }}>EXECUTIONS</div>
                    <div style={{ fontSize: 18, fontWeight: 700, color: "#10b981" }}>{executionHistory.length}</div>
                  </div>
                </div>

                <div style={{ background: "#111827", padding: 12, borderRadius: 6 }}>
                  <div style={{ color: "#cbd5e1", fontSize: 12, fontWeight: 600, marginBottom: 8 }}>
                    Supported Languages
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: 11 }}>
                    <div style={{ display: "flex", justifyContent: "space-between" }}>
                      <span>JavaScript (Node.js 22)</span>
                      <strong style={{ color: "#facc15" }}>Active</strong>
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between" }}>
                      <span>Python 3.12</span>
                      <strong style={{ color: "#38bdf8" }}>Active</strong>
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between" }}>
                      <span>C++ (GCC 14)</span>
                      <strong style={{ color: "#60a5fa" }}>Active</strong>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Panel 7: Teams & Collaborators */}
            {activeActivityTab === "teams" && (
              <div className="ide-panel-view">
                <div className="ide-panel-heading">
                  <Users size={16} color="#38bdf8" />
                  <span>Collaborators</span>
                </div>

                <div style={{ marginBottom: 12, background: "#111827", padding: 10, borderRadius: 6 }}>
                  <div style={{ fontSize: 11, color: "#94a3b8", marginBottom: 4 }}>ROOM CODE</div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <strong style={{ fontSize: 15, color: "#38bdf8" }}>{roomId || "DEMO01"}</strong>
                    <button
                      className="ide-icon-btn"
                      onClick={() => {
                        navigator.clipboard.writeText(roomId || "DEMO01");
                        alert("Room code copied to clipboard!");
                      }}
                      title="Copy code"
                    >
                      <Copy size={13} />
                    </button>
                  </div>
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  {collaborators.map((collab) => (
                    <div
                      key={collab.id}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                        background: "#111827",
                        padding: "8px 10px",
                        borderRadius: 6,
                        fontSize: 12,
                      }}
                    >
                      <span className="ide-collab-dot" />
                      <strong style={{ color: "#f8fafc" }}>{collab.name}</strong>
                      <span style={{ marginLeft: "auto", fontSize: 10, color: "#38bdf8" }}>{collab.role}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Panel 8: Editor Settings */}
            {activeActivityTab === "settings" && (
              <div className="ide-panel-view">
                <div className="ide-panel-heading">
                  <Settings size={16} color="#38bdf8" />
                  <span>Editor Settings</span>
                </div>

                <div className="ide-form-group">
                  <label className="ide-form-label">Font Size ({editorSettings.fontSize}px)</label>
                  <input
                    type="range"
                    min="11"
                    max="22"
                    value={editorSettings.fontSize}
                    onChange={(e) =>
                      setEditorSettings((prev) => ({ ...prev, fontSize: Number(e.target.value) }))
                    }
                  />
                </div>

                <div className="ide-form-group">
                  <label className="ide-form-label">Tab Size</label>
                  <select
                    className="ide-input-text"
                    value={editorSettings.tabSize}
                    onChange={(e) =>
                      setEditorSettings((prev) => ({ ...prev, tabSize: Number(e.target.value) }))
                    }
                  >
                    <option value="2">2 Spaces</option>
                    <option value="4">4 Spaces</option>
                  </select>
                </div>

                <div className="ide-form-group">
                  <label className="ide-form-label">Word Wrap</label>
                  <select
                    className="ide-input-text"
                    value={editorSettings.wordWrap}
                    onChange={(e) =>
                      setEditorSettings((prev) => ({ ...prev, wordWrap: e.target.value }))
                    }
                  >
                    <option value="on">On</option>
                    <option value="off">Off</option>
                  </select>
                </div>

                <div className="ide-form-group">
                  <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12 }}>
                    <input
                      type="checkbox"
                      checked={editorSettings.minimap}
                      onChange={(e) =>
                        setEditorSettings((prev) => ({ ...prev, minimap: e.target.checked }))
                      }
                    />
                    Enable Minimap
                  </label>
                </div>
              </div>
            )}

            {/* Panel 9: Developer Tools */}
            {activeActivityTab === "devtools" && (
              <div className="ide-panel-view">
                <div className="ide-panel-heading">
                  <Wrench size={16} color="#38bdf8" />
                  <span>Developer Tools</span>
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  <button
                    className="ide-pill-action-btn"
                    onClick={() => {
                      if (editorRef.current) {
                        editorRef.current.getAction("editor.action.formatDocument").run();
                      }
                    }}
                  >
                    <span>Format Document</span>
                  </button>

                  <div style={{ background: "#111827", padding: 12, borderRadius: 6, marginTop: 10 }}>
                    <div style={{ color: "#cbd5e1", fontSize: 12, fontWeight: 600, marginBottom: 6 }}>
                      Keyboard Shortcuts
                    </div>
                    <ul style={{ margin: 0, paddingLeft: 16, fontSize: 11, color: "#94a3b8", lineHeight: 1.6 }}>
                      <li><strong style={{ color: "#f8fafc" }}>Ctrl + S</strong> : Save File</li>
                      <li><strong style={{ color: "#f8fafc" }}>Ctrl + Enter</strong> : Run Code</li>
                      <li><strong style={{ color: "#f8fafc" }}>Ctrl + F</strong> : Find</li>
                      <li><strong style={{ color: "#f8fafc" }}>Alt + Shift + F</strong> : Format</li>
                    </ul>
                  </div>
                </div>
              </div>
            )}
          </aside>
        )}

        {/* ======================================================================
            Main Surface (Tabs + Monaco + Floating Pill + Resizable Bottom Drawer)
        ====================================================================== */}
        <main className="ide-main-surface">
          {/* Tabs Bar */}
          <div className="ide-tabs-bar">
            {openTabIds.map((tabId) => {
              const file = files.find((f) => f.id === tabId);
              if (!file) return null;
              const isActive = activeFileId === tabId;
              const isDirty = dirtyFiles[tabId];

              return (
                <div
                  key={tabId}
                  className={`ide-tab ${isActive ? "active" : ""}`}
                  onClick={() => setActiveFileId(tabId)}
                >
                  {renderLanguageBadge(file.language)}
                  <span className="ide-tab-name">{file.name}</span>
                  {isDirty ? (
                    <span className="ide-tab-dirty-dot" title="Unsaved changes" />
                  ) : (
                    <button
                      className="ide-tab-close"
                      onClick={(e) => closeTab(e, tabId)}
                      title="Close Tab"
                    >
                      <X size={12} />
                    </button>
                  )}
                </div>
              );
            })}

            <button
              className="ide-tab-add-btn"
              onClick={() => setNewFileInput({ parentPath: "", isFolder: false })}
              title="Add File"
            >
              <Plus size={14} />
            </button>
          </div>

          {/* Monaco Editor Surface */}
          <div className="ide-editor-workspace">
            {activeFile ? (
              <Editor
                height="100%"
                language={activeFile.language || "javascript"}
                value={activeFile.content || ""}
                theme="cocode-dark"
                beforeMount={handleEditorWillMount}
                onMount={handleEditorDidMount}
                onChange={handleCodeChange}
                options={{
                  fontSize: editorSettings.fontSize,
                  tabSize: editorSettings.tabSize,
                  wordWrap: editorSettings.wordWrap,
                  minimap: { enabled: editorSettings.minimap },
                  lineNumbers: editorSettings.lineNumbers,
                  scrollBeyondLastLine: false,
                  automaticLayout: true,
                  fontFamily: "'JetBrains Mono', 'Fira Code', 'Consolas', monospace",
                  fontLigatures: true,
                  renderLineHighlight: "all",
                  cursorBlinking: "smooth",
                  smoothScrolling: true,
                  bracketPairColorization: { enabled: true },
                }}
              />
            ) : (
              <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", color: "#64748b" }}>
                Select or create a file from the explorer to begin editing.
              </div>
            )}

            {/* Floating pill: "CoCode • Collaborate in real time" (Exact reference screenshot match) */}
            <div className="ide-floating-collab-pill">
              <span>CoCode</span> • Collaborate in real time
            </div>
          </div>

          {/* Resizable Bottom Panel (Output / Terminal / Input / History) */}
          <section
            className="ide-bottom-panel"
            style={{
              height: isBottomPanelCollapsed ? 36 : bottomPanelHeight,
            }}
          >
            {/* Draggable panel resizer */}
            {!isBottomPanelCollapsed && (
              <div
                className="ide-panel-resizer"
                onMouseDown={(e) => {
                  isResizingRef.current = true;
                  const startY = e.clientY;
                  const startH = bottomPanelHeight;
                  const onMouseMove = (moveEvent) => {
                    if (!isResizingRef.current) return;
                    const delta = startY - moveEvent.clientY;
                    setBottomPanelHeight(Math.max(120, Math.min(500, startH + delta)));
                  };
                  const onMouseUp = () => {
                    isResizingRef.current = false;
                    window.removeEventListener("mousemove", onMouseMove);
                    window.removeEventListener("mouseup", onMouseUp);
                  };
                  window.addEventListener("mousemove", onMouseMove);
                  window.addEventListener("mouseup", onMouseUp);
                }}
              />
            )}

            <div className="ide-bottom-panel-header">
              <div className="ide-bottom-panel-tabs">
                <button
                  className={`ide-panel-tab ${bottomPanelTab === "output" ? "active" : ""}`}
                  onClick={() => {
                    setBottomPanelTab("output");
                    setIsBottomPanelCollapsed(false);
                  }}
                >
                  <Terminal size={13} />
                  <span>Output</span>
                </button>
                <button
                  className={`ide-panel-tab ${bottomPanelTab === "stdin" ? "active" : ""}`}
                  onClick={() => {
                    setBottomPanelTab("stdin");
                    setIsBottomPanelCollapsed(false);
                  }}
                >
                  <span>Input (stdin)</span>
                </button>
                <button
                  className={`ide-panel-tab ${bottomPanelTab === "history" ? "active" : ""}`}
                  onClick={() => {
                    setBottomPanelTab("history");
                    setIsBottomPanelCollapsed(false);
                  }}
                >
                  <span>Execution History</span>
                </button>
              </div>

              <div className="ide-bottom-panel-actions">
                <button
                  className="ide-icon-btn"
                  onClick={() => {
                    if (executionOutput.stdout) {
                      navigator.clipboard.writeText(executionOutput.stdout);
                    }
                  }}
                  title="Copy Output"
                >
                  <Copy size={13} />
                </button>
                <button
                  className="ide-icon-btn"
                  onClick={() =>
                    setExecutionOutput({
                      stdout: "",
                      stderr: "",
                      compileOutput: "",
                      status: "Cleared",
                      time: null,
                      memory: null,
                    })
                  }
                  title="Clear Output"
                >
                  <Trash2 size={13} />
                </button>
                <button
                  className="ide-icon-btn"
                  onClick={() => setIsBottomPanelCollapsed(!isBottomPanelCollapsed)}
                  title={isBottomPanelCollapsed ? "Expand Panel" : "Collapse Panel"}
                >
                  {isBottomPanelCollapsed ? <ChevronDown size={14} /> : <X size={14} />}
                </button>
              </div>
            </div>

            {!isBottomPanelCollapsed && (
              <div className="ide-bottom-panel-body">
                {bottomPanelTab === "output" && (
                  <div>
                    {isExecuting && (
                      <div style={{ color: "#38bdf8", marginBottom: 8 }}>
                        ⚡ Executing program on secure runner...
                      </div>
                    )}
                    {executionOutput.stdout && (
                      <div className="ide-output-stdout">{executionOutput.stdout}</div>
                    )}
                    {executionOutput.stderr && (
                      <div className="ide-output-stderr">{executionOutput.stderr}</div>
                    )}
                    {executionOutput.compileOutput && (
                      <div className="ide-output-compile">{executionOutput.compileOutput}</div>
                    )}
                    {!executionOutput.stdout && !executionOutput.stderr && !executionOutput.compileOutput && !isExecuting && (
                      <div style={{ color: "#64748b" }}>Click "Run Code" to compile and execute program.</div>
                    )}

                    {executionOutput.time !== null && (
                      <div className="ide-output-meta">
                        <span>Status: <strong style={{ color: executionOutput.status === "Error" ? "#ef4444" : "#10b981" }}>{executionOutput.status}</strong></span>
                        {executionOutput.time && <span>Time: {executionOutput.time}s</span>}
                        {executionOutput.memory && <span>Memory: {(executionOutput.memory / 1024).toFixed(1)} MB</span>}
                      </div>
                    )}
                  </div>
                )}

                {bottomPanelTab === "stdin" && (
                  <textarea
                    className="ide-stdin-textarea"
                    placeholder="Enter standard input (stdin) passed to your program on execution..."
                    value={stdinValue}
                    onChange={(e) => setStdinValue(e.target.value)}
                  />
                )}

                {bottomPanelTab === "history" && (
                  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    {executionHistory.map((run) => (
                      <div
                        key={run.id}
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          padding: "6px 10px",
                          background: "#111827",
                          borderRadius: 4,
                          fontSize: 12,
                        }}
                      >
                        <div>
                          <strong style={{ color: "#f8fafc" }}>{run.language}</strong>
                          <span style={{ color: "#64748b", marginLeft: 8 }}>
                            {new Date(run.timestamp).toLocaleTimeString()}
                          </span>
                        </div>
                        <div style={{ display: "flex", gap: 10 }}>
                          <span style={{ color: "#38bdf8" }}>{run.time}</span>
                          <span style={{ color: "#10b981" }}>{run.status}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </section>
        </main>
      </div>
    </div>
  );
}
