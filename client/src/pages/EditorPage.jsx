import React, { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { useParams, useSearchParams, Link, useNavigate } from "react-router-dom";
import Editor from "@monaco-editor/react";
import JSZip from "jszip";
import { io } from "socket.io-client";
import * as Y from "yjs";
import { MonacoBinding } from "y-monaco";
import {
  Files,
  Search,
  History,
  Play,
  Square,
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
  Trash2,
  Edit2,
  Copy,
  Terminal,
  Send,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Folder,
  FileCode,
  FileText,
  Sliders,
  Share2,
  LogOut,
  AlertTriangle,
  RotateCcw,
  Check,
  Save,
  ChevronRight,
} from "lucide-react";
import { useAuth } from "../AuthContext.jsx";
import { API_BASE } from "../config/api.js";
import FileTree from "../components/ide/FileTree.jsx";
import FindReplaceWidget from "../components/ide/FindReplaceWidget.jsx";
import CommandPalette from "../components/ide/CommandPalette.jsx";
import QuickOpen from "../components/ide/QuickOpen.jsx";
import TerminalConsole from "../components/ide/TerminalConsole.jsx";
import ConfirmModal from "../components/ide/ConfirmModal.jsx";
import "./EditorPage.css";

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
  },
];

export default function EditorPage() {
  const { roomId } = useParams();
  const [searchParams] = useSearchParams();
  const { user, token } = useAuth();
  const navigate = useNavigate();

  // Persistent Project state (Phase 7)
  const projectId = searchParams.get("projectId");
  const [projectData, setProjectData] = useState(null);
  const [projectLoading, setProjectLoading] = useState(() => Boolean(projectId));
  const [saveStatus, setSaveStatus] = useState("saved"); // "saved" | "saving" | "unsaved" | "error"

  // Connection and Room collaboration state (Phase 6)
  const [connectionStatus, setConnectionStatus] = useState(() => (roomId ? "connecting" : "disconnected"));
  const [roomError, setRoomError] = useState(null);
  const [roomCopied, setRoomCopied] = useState(false);
  const isRemoteUpdateRef = useRef(false);

  // Active activity bar tab: files | search | history | run | chat | analytics | teams | settings | devtools
  const [activeActivityTab, setActiveActivityTab] = useState("files");

  // Files & Folders state
  const projectStorageKey = useMemo(() => `cocode-ide-files-${roomId || projectId || "default"}`, [roomId, projectId]);
  const [files, setFiles] = useState(() => {
    try {
      const saved = localStorage.getItem(projectStorageKey);
      if (saved) return JSON.parse(saved);
    } catch {}
    return DEFAULT_FILES;
  });

  // Open Editor tabs (Phase 8.3)
  const [openTabIds, setOpenTabIds] = useState(["f-1"]);
  const [activeFileId, setActiveFileId] = useState("f-1");
  const [dirtyFiles, setDirtyFiles] = useState({}); // { [fileId]: true }

  // Folder collapse state (Phase 8.2)
  const [expandedFolders, setExpandedFolders] = useState({ "/src": true });

  // Dialog and Modal states
  const [confirmModal, setConfirmModal] = useState({
    isOpen: false,
    title: "",
    message: "",
    confirmText: "Delete",
    confirmVariant: "danger",
    onConfirm: null,
  });

  // Find & Replace Overlay Widget state (Phase 8.4)
  const [isFindOpen, setIsFindOpen] = useState(false);

  // Command Palette & Quick Open state (Phase 8.7)
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);
  const [isQuickOpenOpen, setIsQuickOpenOpen] = useState(false);

  // Toast / Status Message
  const [toastMessage, setToastMessage] = useState(null);

  // Editor Settings state (persisted per user)
  const settingsStorageKey = useMemo(() => `cocode_editor_settings_${user?.id || "guest"}`, [user?.id]);
  const [editorSettings, setEditorSettings] = useState(() => {
    try {
      const saved = localStorage.getItem(settingsStorageKey);
      if (saved) return JSON.parse(saved);
    } catch {}
    return {
      theme: "cocode-dark",
      fontSize: 14,
      tabSize: 4,
      wordWrap: "on",
      minimap: true,
      lineNumbers: "on",
      autoSave: true,
      autoSaveDelay: 1500,
      formatOnSave: false,
    };
  });

  // Save settings to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(settingsStorageKey, JSON.stringify(editorSettings));
    } catch {}
  }, [editorSettings, settingsStorageKey]);

  // Bottom Panel State (terminal, output, stdin, problems, history)
  const [bottomPanelTab, setBottomPanelTab] = useState("terminal");
  const [bottomPanelHeight, setBottomPanelHeight] = useState(220);
  const [isBottomPanelCollapsed, setIsBottomPanelCollapsed] = useState(false);
  const [stdinValue, setStdinValue] = useState("");
  const [isExecuting, setIsExecuting] = useState(false);
  const [executionOutput, setExecutionOutput] = useState({
    stdout: "Hello world\n",
    stderr: "",
    compileOutput: "",
    status: "Finished",
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
    },
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
    },
  ]);

  // Global Project Search state (Phase 8.4)
  const [searchQuery, setSearchQuery] = useState("");
  const [matchCase, setMatchCase] = useState(false);
  const [wholeWord, setWholeWord] = useState(false);
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);

  // Chat & Real-Time Collaboration state (Phase 6)
  const [chatMessages, setChatMessages] = useState([
    {
      id: "msg-1",
      senderId: "system",
      senderName: "CoCode Bot",
      text: `Connected to IDE session ${roomId ? `[Room: ${roomId}]` : "(Local Project)"}.`,
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    },
  ]);
  const [chatInput, setChatInput] = useState("");
  const [collaborators, setCollaborators] = useState([
    { id: user?.id || "u-current", name: user?.name || "Developer", role: "Host", online: true },
  ]);

  const editorRef = useRef(null);
  const monacoRef = useRef(null);
  const socketRef = useRef(null);
  const isResizingRef = useRef(false);
  const yDocsRef = useRef(new Map());
  const yBindingRef = useRef(null);

  // Phase 8.9: Per-file save tracking, view state caching, and autosave timers
  const fileVersionRef = useRef(new Map()); // fileId -> integer revision
  const fileContentRef = useRef(new Map()); // fileId -> latest string content
  const fileSavedVersionRef = useRef(new Map()); // fileId -> last successfully saved revision
  const fileSavingInFlightRef = useRef(new Map()); // fileId -> boolean
  const fileNeedsReSaveRef = useRef(new Map()); // fileId -> boolean
  const autoSaveTimersRef = useRef(new Map()); // fileId -> timerId
  const viewStatesRef = useRef(new Map()); // fileId -> ICodeEditorViewState
  const activeFileIdRef = useRef(activeFileId);

  // Active file resolution
  const activeFile = useMemo(() => {
    return (
      files.find((f) => f.id === activeFileId && !f.isFolder) ||
      files.find((f) => !f.isFolder && f.name !== ".cocode-keep") ||
      null
    );
  }, [files, activeFileId]);

  // Clean up all autosave timers when component unmounts
  useEffect(() => {
    return () => {
      autoSaveTimersRef.current.forEach((timer) => clearTimeout(timer));
      autoSaveTimersRef.current.clear();
    };
  }, []);

  // Helper to read the freshest content for any file (preferring live Monaco model)
  const getLatestFileContent = useCallback((fileId) => {
    if (activeFileId === fileId && editorRef.current) {
      const model = editorRef.current.getModel();
      if (model) {
        const val = model.getValue();
        fileContentRef.current.set(fileId, val);
        return val;
      }
    }
    if (fileContentRef.current.has(fileId)) {
      return fileContentRef.current.get(fileId);
    }
    const f = files.find((item) => item.id === fileId);
    return f ? f.content || "" : "";
  }, [activeFileId, files]);

  // Toast notification helper
  const showToast = useCallback((msg, duration = 2500) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage((cur) => (cur === msg ? null : cur));
    }, duration);
  }, []);

  // Save files to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(projectStorageKey, JSON.stringify(files));
    } catch {}
  }, [files, projectStorageKey]);

  // Load persistent project from database when projectId is in URL
  const fetchProjectData = useCallback(async () => {
    if (!projectId || !token) return;

    setProjectLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/projects/${projectId}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!res.ok) {
        throw new Error(`Failed to load project (${res.status})`);
      }

      const data = await res.json();
      if (data.project) {
        setProjectData(data.project);
        if (data.project.files && data.project.files.length > 0) {
          const serverFiles = data.project.files.map((f) => ({
            id: f.id,
            name: f.name,
            path: f.path,
            language: f.language,
            content: f.content || "",
            isFolder: false,
          }));
          setFiles(serverFiles);
          const firstNonKeep = serverFiles.find((f) => f.name !== ".cocode-keep") || serverFiles[0];
          setOpenTabIds([firstNonKeep.id]);
          setActiveFileId(firstNonKeep.id);
        }
      }
    } catch (err) {
      console.error("Project load error:", err);
    } finally {
      setProjectLoading(false);
    }
  }, [projectId, token]);

  useEffect(() => {
    fetchProjectData();
  }, [fetchProjectData]);

  // Initialize Socket.IO connection for real-time room collaboration (Phase 6)
  useEffect(() => {
    if (!roomId) return;

    setConnectionStatus("connecting");
    setRoomError(null);

    try {
      const socket = io(API_BASE, {
        auth: { token },
        transports: ["websocket", "polling"],
        reconnection: true,
        reconnectionAttempts: 10,
        reconnectionDelay: 1000,
      });
      socketRef.current = socket;

      socket.on("connect", () => {
        setConnectionStatus("connected");
        setRoomError(null);
        socket.emit("room:join", {
          roomCode: roomId,
          displayName: user?.name || "Developer",
        });
      });

      socket.on("connect_error", (err) => {
        setConnectionStatus("error");
        setRoomError(err.message || "Failed to connect to collaboration server.");
      });

      socket.on("reconnect_attempt", () => {
        setConnectionStatus("reconnecting");
      });

      socket.on("reconnect", () => {
        setConnectionStatus("connected");
        setRoomError(null);
        socket.emit("room:join", {
          roomCode: roomId,
          displayName: user?.name || "Developer",
        });
      });

      socket.on("disconnect", (reason) => {
        if (reason === "io client disconnect") {
          setConnectionStatus("disconnected");
        } else {
          setConnectionStatus("reconnecting");
        }
      });

      // Synchronize files and presence on joining room
      socket.on("room:joined", (data) => {
        setConnectionStatus("connected");
        setRoomError(null);
        if (data.state && Array.isArray(data.state.files) && data.state.files.length > 0) {
          isRemoteUpdateRef.current = true;

          // Re-hydrate local Yjs documents
          data.state.files.forEach((remoteFile) => {
            let doc = yDocsRef.current.get(remoteFile.fileId);
            if (!doc) {
              doc = new Y.Doc();
              yDocsRef.current.set(remoteFile.fileId, doc);
            }
            if (remoteFile.yjsUpdate && remoteFile.yjsUpdate.length > 0) {
              try {
                Y.applyUpdate(doc, new Uint8Array(remoteFile.yjsUpdate), "remote");
              } catch (e) {
                console.warn("Error applying remote Yjs state:", e);
              }
            } else if (remoteFile.content !== undefined) {
              const yText = doc.getText("monaco");
              if (yText.toString() !== remoteFile.content) {
                doc.transact(() => {
                  yText.delete(0, yText.length);
                  yText.insert(0, remoteFile.content);
                }, "remote");
              }
            }
          });

          // Synchronize files state with persistent documents from server
          setFiles((prev) => {
            const fileMap = new Map(prev.map((f) => [f.id, f]));
            data.state.files.forEach((remoteFile) => {
              if (fileMap.has(remoteFile.fileId)) {
                const existing = fileMap.get(remoteFile.fileId);
                fileMap.set(remoteFile.fileId, {
                  ...existing,
                  name: remoteFile.filename || existing.name,
                  content: remoteFile.content ?? existing.content,
                  language: remoteFile.language || existing.language,
                });
              } else {
                fileMap.set(remoteFile.fileId, {
                  id: remoteFile.fileId,
                  name: remoteFile.filename || remoteFile.fileId,
                  path: `/${remoteFile.filename || remoteFile.fileId}`,
                  language: remoteFile.language || "javascript",
                  content: remoteFile.content || "",
                  isFolder: false,
                });
              }
            });
            return Array.from(fileMap.values());
          });

          setTimeout(() => {
            isRemoteUpdateRef.current = false;
          }, 60);
        }

        if (Array.isArray(data.presence)) {
          setCollaborators(
            data.presence.map((p, idx) => ({
              id: p.userId || `collab-${idx}`,
              name: p.userName || "Developer",
              role: idx === 0 ? "Host" : "Participant",
              online: true,
            }))
          );
        }
      });

      // User presence update
      socket.on("user:presence", (data) => {
        if (Array.isArray(data.presence)) {
          setCollaborators(
            data.presence.map((p, idx) => ({
              id: p.userId || `collab-${idx}`,
              name: p.userName || "Developer",
              role: idx === 0 ? "Host" : "Participant",
              online: true,
            }))
          );
        }
      });

      // User joined / left notifications
      socket.on("user:joined", (data) => {
        setChatMessages((prev) => [
          ...prev,
          {
            id: `sys-${Date.now()}`,
            senderId: "system",
            senderName: "System",
            text: `${data.userName || "A collaborator"} joined the session.`,
            timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
          },
        ]);
      });

      socket.on("user:left", (data) => {
        setChatMessages((prev) => [
          ...prev,
          {
            id: `sys-${Date.now()}`,
            senderId: "system",
            senderName: "System",
            text: `${data.userName || "A collaborator"} disconnected.`,
            timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
          },
        ]);
      });

      socket.on("room:error", (errData) => {
        setRoomError(errData?.message || "Room error occurred.");
      });

      // Incremental Yjs CRDT update from peer
      socket.on("yjs:update", (data) => {
        if (!data || !data.fileId || !data.update) return;

        let doc = yDocsRef.current.get(data.fileId);
        if (!doc) {
          doc = new Y.Doc();
          yDocsRef.current.set(data.fileId, doc);
        }

        try {
          Y.applyUpdate(doc, new Uint8Array(data.update), "remote");
          const updatedContent = doc.getText("monaco").toString();

          isRemoteUpdateRef.current = true;
          setFiles((prev) =>
            prev.map((f) => (f.id === data.fileId ? { ...f, content: updatedContent } : f))
          );
          setTimeout(() => {
            isRemoteUpdateRef.current = false;
          }, 30);
        } catch (err) {
          console.warn("Failed to apply remote Yjs update:", err);
        }
      });

      // Canonical and legacy full text updates
      const handleRemoteCodeChange = (data) => {
        if (!data || !data.fileId || data.content === undefined) return;
        let doc = yDocsRef.current.get(data.fileId);
        if (doc) {
          const yText = doc.getText("monaco");
          if (yText.toString() === data.content) return;
          doc.transact(() => {
            yText.delete(0, yText.length);
            yText.insert(0, data.content);
          }, "remote");
        }

        isRemoteUpdateRef.current = true;
        setFiles((prev) =>
          prev.map((f) => (f.id === data.fileId ? { ...f, content: data.content } : f))
        );
        setTimeout(() => {
          isRemoteUpdateRef.current = false;
        }, 60);
      };

      socket.on("code:update", handleRemoteCodeChange);
      socket.on("code-change", handleRemoteCodeChange);

      // Handle chat messages
      const handleIncomingChatMessage = (msg) => {
        if (!msg || !msg.id) return;
        setChatMessages((prev) => {
          const existingIdx = prev.findIndex((m) => m.id === msg.id);
          if (existingIdx !== -1) {
            const updated = [...prev];
            updated[existingIdx] = { ...updated[existingIdx], ...msg, optimistic: false };
            return updated;
          }
          const optIdx = prev.findIndex(
            (m) =>
              m.optimistic &&
              (m.senderId === msg.senderId || m.senderId === (user?.id || "u-current")) &&
              m.text === msg.text
          );
          if (optIdx !== -1) {
            const updated = [...prev];
            updated[optIdx] = { ...msg, optimistic: false };
            return updated;
          }
          return [...prev, msg];
        });
      };

      socket.on("chat:message", handleIncomingChatMessage);
      socket.on("chat-message", handleIncomingChatMessage);

      return () => {
        socket.off("code:update", handleRemoteCodeChange);
        socket.off("code-change", handleRemoteCodeChange);
        socket.off("chat:message", handleIncomingChatMessage);
        socket.off("chat-message", handleIncomingChatMessage);
        socket.disconnect();
      };
    } catch (err) {
      console.warn("Socket.IO connection failed:", err);
      setConnectionStatus("error");
      setRoomError("Could not initialize real-time connection.");
    }
  }, [roomId, token, user]);

  // Setup Monaco Dark Theme
  function handleEditorWillMount(monaco) {
    monacoRef.current = monaco;
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

  function handleEditorDidMount(editor, monaco) {
    editorRef.current = editor;
    monacoRef.current = monaco;
    if (activeFileId && viewStatesRef.current.has(activeFileId)) {
      const vs = viewStatesRef.current.get(activeFileId);
      if (vs) {
        try {
          editor.restoreViewState(vs);
        } catch {}
      }
    }
  }

  // Set up Yjs Monaco Binding for collaborative room active file (Phase 6)
  useEffect(() => {
    if (!roomId || !editorRef.current || !activeFile) return;

    let doc = yDocsRef.current.get(activeFile.id);
    if (!doc) {
      doc = new Y.Doc();
      const yText = doc.getText("monaco");
      if (activeFile.content) {
        yText.insert(0, activeFile.content);
      }
      yDocsRef.current.set(activeFile.id, doc);
    }

    const yText = doc.getText("monaco");
    let model = editorRef.current.getModel();
    if (monacoRef.current) {
      const targetUri = monacoRef.current.Uri.parse(activeFile.path || activeFile.id);
      const targetModel = monacoRef.current.editor.getModel(targetUri);
      if (targetModel) {
        model = targetModel;
        if (editorRef.current.getModel() !== targetModel) {
          editorRef.current.setModel(targetModel);
        }
      }
    }
    if (!model) return;

    if (yText.length === 0 && activeFile.content) {
      yText.insert(0, activeFile.content);
    }

    if (yBindingRef.current) {
      try {
        yBindingRef.current.destroy();
      } catch {}
      yBindingRef.current = null;
    }

    const currentText = yText.toString();
    if (model.getValue() !== currentText) {
      model.setValue(currentText);
    }

    const handleLocalUpdate = (update, origin) => {
      if (origin !== "remote" && socketRef.current && socketRef.current.connected) {
        socketRef.current.emit("yjs:update", {
          roomCode: roomId,
          fileId: activeFile.id,
          update: Array.from(update),
        });
      }
    };

    doc.on("update", handleLocalUpdate);

    let binding = null;
    try {
      binding = new MonacoBinding(yText, model, new Set([editorRef.current]));
      yBindingRef.current = binding;
    } catch (err) {
      console.warn("MonacoBinding initialization:", err);
    }

    return () => {
      doc.off("update", handleLocalUpdate);
      if (binding) {
        try {
          binding.destroy();
        } catch {}
      }
      yBindingRef.current = null;
    };
  }, [roomId, activeFile?.id]);

  // Save current editor view state (scroll, cursor, selection)
  const saveCurrentViewState = useCallback(() => {
    if (activeFileId && editorRef.current) {
      try {
        const vs = editorRef.current.saveViewState();
        if (vs) {
          viewStatesRef.current.set(activeFileId, vs);
        }
      } catch {}
    }
  }, [activeFileId]);

  // Switch active file while preserving editor view state (Phase 8.9)
  const switchActiveFile = useCallback(
    (nextFileId) => {
      if (activeFileId === nextFileId) return;
      saveCurrentViewState();
      setActiveFileId(nextFileId);
    },
    [activeFileId, saveCurrentViewState]
  );

  // Restore editor view state when active file changes
  useEffect(() => {
    if (!editorRef.current || !activeFileId) return;
    const savedVs = viewStatesRef.current.get(activeFileId);
    if (savedVs) {
      const raf = requestAnimationFrame(() => {
        if (editorRef.current && activeFileIdRef.current === activeFileId) {
          try {
            editorRef.current.restoreViewState(savedVs);
            editorRef.current.focus();
          } catch {}
        }
      });
      return () => cancelAnimationFrame(raf);
    } else {
      editorRef.current.focus();
    }
  }, [activeFileId]);

  // Save a specific file by ID with revision snapshot & in-flight tracking (Phase 8.9)
  const saveFileById = useCallback(
    async (fileId) => {
      if (!fileId) return;
      const file = files.find((f) => f.id === fileId);
      if (!file || file.isFolder) return;

      // Clear pending autosave timer for this specific file
      const timer = autoSaveTimersRef.current.get(fileId);
      if (timer) {
        clearTimeout(timer);
        autoSaveTimersRef.current.delete(fileId);
      }

      // If a save is already in-flight for this file, flag that it needs re-saving once finished
      if (fileSavingInFlightRef.current.get(fileId)) {
        fileNeedsReSaveRef.current.set(fileId, true);
        return;
      }

      // Optional format on save if active file
      if (editorSettings.formatOnSave && activeFileId === fileId && editorRef.current) {
        try {
          editorRef.current.getAction("editor.action.formatDocument")?.run();
        } catch {}
      }

      // Capture exact target version and fresh content snapshot at this instant
      const targetVersion = fileVersionRef.current.get(fileId) || 0;
      const contentToSave = getLatestFileContent(fileId);

      fileSavingInFlightRef.current.set(fileId, true);
      fileNeedsReSaveRef.current.delete(fileId);

      if (activeFileId === fileId) {
        setSaveStatus("saving");
      }

      if (projectId && token) {
        try {
          const res = await fetch(`${API_BASE}/api/projects/${projectId}/files/${fileId}`, {
            method: "PUT",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({
              content: contentToSave,
              language: file.language || "javascript",
            }),
          });

          if (!res.ok) {
            throw new Error(`Failed to save file to server (${res.status})`);
          }

          fileSavedVersionRef.current.set(fileId, targetVersion);

          // Clear dirty state only if no new edits arrived during save
          const currentVersion = fileVersionRef.current.get(fileId) || 0;
          if (currentVersion === targetVersion) {
            setDirtyFiles((prev) => {
              const next = { ...prev };
              delete next[fileId];
              return next;
            });
            if (activeFileId === fileId) {
              setSaveStatus("saved");
            }
          }
          showToast(`Saved ${file.name}`);
        } catch (err) {
          console.error("Save file error:", err);
          if (activeFileId === fileId) {
            setSaveStatus("error");
          }
        } finally {
          fileSavingInFlightRef.current.delete(fileId);

          // If newer content was edited while request was running, immediately persist newer edits
          if (
            fileNeedsReSaveRef.current.get(fileId) ||
            (fileVersionRef.current.get(fileId) || 0) > targetVersion
          ) {
            fileNeedsReSaveRef.current.delete(fileId);
            saveFileById(fileId);
          }
        }
      } else {
        // Local standalone save
        fileSavedVersionRef.current.set(fileId, targetVersion);
        const currentVersion = fileVersionRef.current.get(fileId) || 0;
        if (currentVersion === targetVersion) {
          setDirtyFiles((prev) => {
            const next = { ...prev };
            delete next[fileId];
            return next;
          });
          if (activeFileId === fileId) {
            setSaveStatus("saved");
          }
        }
        fileSavingInFlightRef.current.delete(fileId);
        showToast(`Saved ${file.name} (local)`);
      }

      // Add version revision snapshot
      const newRev = {
        id: `rev-${Date.now()}`,
        fileId,
        filename: file.name,
        timestamp: Date.now(),
        content: contentToSave,
        author: user?.name || "Developer",
      };
      setFileRevisions((prev) => [newRev, ...prev]);
    },
    [
      files,
      activeFileId,
      editorSettings.formatOnSave,
      getLatestFileContent,
      projectId,
      token,
      user?.name,
      showToast,
    ]
  );

  // Save current active file
  const saveCurrentFile = useCallback(async () => {
    if (!activeFileId) return;
    await saveFileById(activeFileId);
  }, [activeFileId, saveFileById]);

  // Save All open modified files with content snapshot verification (Phase 8.9)
  const saveAllFiles = useCallback(async () => {
    const dirtyIds = Object.keys(dirtyFiles).filter((id) => dirtyFiles[id]);
    if (dirtyIds.length === 0) {
      showToast("All files are up to date.");
      return;
    }

    // Cancel pending autosaves for all dirty files
    dirtyIds.forEach((id) => {
      const timer = autoSaveTimersRef.current.get(id);
      if (timer) {
        clearTimeout(timer);
        autoSaveTimersRef.current.delete(id);
      }
    });

    // Capture exact snapshot of content and versions at this instant
    const snapshot = dirtyIds.map((id) => {
      const f = files.find((file) => file.id === id);
      return {
        id,
        name: f?.name || id,
        language: f?.language || "javascript",
        content: getLatestFileContent(id),
        version: fileVersionRef.current.get(id) || 0,
      };
    });

    setSaveStatus("saving");

    if (projectId && token) {
      try {
        const res = await fetch(`${API_BASE}/api/projects/${projectId}/save-all`, {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            files: snapshot.map((s) => ({
              id: s.id,
              content: s.content,
              language: s.language,
            })),
          }),
        });

        if (!res.ok) {
          throw new Error(`Failed to batch save files (${res.status})`);
        }

        // Only clear dirty state for files whose version has not changed while request was in-flight
        setDirtyFiles((prev) => {
          const next = { ...prev };
          snapshot.forEach((item) => {
            const currentVersion = fileVersionRef.current.get(item.id) || 0;
            if (currentVersion === item.version) {
              delete next[item.id];
              fileSavedVersionRef.current.set(item.id, item.version);
            }
          });
          return next;
        });

        setSaveStatus("saved");
        showToast(`Saved ${snapshot.length} modified files.`);
      } catch (err) {
        console.error("Save all error:", err);
        setSaveStatus("error");
        showToast("Save all failed. Dirty changes retained.");
      }
    } else {
      // Local standalone save
      setDirtyFiles((prev) => {
        const next = { ...prev };
        snapshot.forEach((item) => {
          const currentVersion = fileVersionRef.current.get(item.id) || 0;
          if (currentVersion === item.version) {
            delete next[item.id];
            fileSavedVersionRef.current.set(item.id, item.version);
          }
        });
        return next;
      });
      setSaveStatus("saved");
      showToast(`Saved ${snapshot.length} files (local).`);
    }
  }, [dirtyFiles, files, getLatestFileContent, projectId, token, showToast]);

  // Handle Code Change with per-file debounced autosave (Phase 8.9)
  function handleCodeChange(newContent) {
    if (!activeFile) return;
    const fileId = activeFile.id;
    const content = newContent || "";

    // Increment per-file revision counter and update live cache
    const newVersion = (fileVersionRef.current.get(fileId) || 0) + 1;
    fileVersionRef.current.set(fileId, newVersion);
    fileContentRef.current.set(fileId, content);

    // Update dirty state and unsaved indicator
    setDirtyFiles((prev) => ({ ...prev, [fileId]: true }));
    if (fileId === activeFileId) {
      setSaveStatus("unsaved");
    }

    // Update in-memory file list
    setFiles((prev) =>
      prev.map((f) => (f.id === fileId ? { ...f, content } : f))
    );

    // Collaboration room broadcast fallback
    if (roomId && socketRef.current && !isRemoteUpdateRef.current && !yBindingRef.current) {
      socketRef.current.emit("code:update", {
        roomCode: roomId,
        fileId,
        content,
        language: activeFile.language || "javascript",
      });
    }

    // Debounced Autosave on a per-file timer (Phase 8.9)
    if (editorSettings.autoSave) {
      const existingTimer = autoSaveTimersRef.current.get(fileId);
      if (existingTimer) clearTimeout(existingTimer);

      const delay = editorSettings.autoSaveDelay || 1500;
      const timerId = setTimeout(() => {
        autoSaveTimersRef.current.delete(fileId);
        saveFileById(fileId);
      }, delay);

      autoSaveTimersRef.current.set(fileId, timerId);
    }
  }

  // Format document action (Phase 8.5)
  const formatDocument = useCallback(() => {
    if (editorRef.current) {
      try {
        editorRef.current.getAction("editor.action.formatDocument")?.run();
        showToast("Document formatted");
      } catch (err) {
        console.warn("Formatting failed:", err);
      }
    }
  }, [showToast]);

  // File and Folder operations (Phase 8.2)
  async function handleCreateFile(parentPath, name) {
    const cleanPath = `${parentPath}/${name}`.replace(/\/+/g, "/");

    let language = "javascript";
    if (name.endsWith(".py")) language = "python";
    else if (name.endsWith(".cpp") || name.endsWith(".cc")) language = "cpp";
    else if (name.endsWith(".c")) language = "c";
    else if (name.endsWith(".html")) language = "html";
    else if (name.endsWith(".css")) language = "css";
    else if (name.endsWith(".json")) language = "json";
    else if (name.endsWith(".md")) language = "markdown";

    if (projectId && token) {
      try {
        const res = await fetch(`${API_BASE}/api/projects/${projectId}/files`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            name,
            path: cleanPath,
            language,
            content: "",
          }),
        });

        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData.error || errData.message || "Failed to create file.");
        }

        const data = await res.json();
        const serverFile = data.file;

        const newItem = {
          id: serverFile.id,
          name: serverFile.name,
          path: serverFile.path,
          language: serverFile.language,
          content: serverFile.content || "",
          isFolder: false,
        };

        setFiles((prev) => [...prev, newItem]);
        setOpenTabIds((prev) => [...prev, newItem.id]);
        setActiveFileId(newItem.id);
        showToast(`Created ${name}`);
      } catch (err) {
        alert(err.message || "Failed to create file.");
      }
    } else {
      const newItem = {
        id: `f-${Date.now()}`,
        name,
        path: cleanPath,
        language,
        content: "",
        isFolder: false,
      };

      setFiles((prev) => [...prev, newItem]);
      setOpenTabIds((prev) => [...prev, newItem.id]);
      setActiveFileId(newItem.id);
      showToast(`Created ${name}`);
    }
  }

  async function handleCreateFolder(parentPath, name) {
    const cleanPath = `${parentPath}/${name}`.replace(/\/+/g, "/");

    if (projectId && token) {
      try {
        const res = await fetch(`${API_BASE}/api/projects/${projectId}/folders`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ path: cleanPath }),
        });

        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData.error || errData.message || "Failed to create folder.");
        }

        // Add placeholder marker file so folder is retained in tree
        const keepItem = {
          id: `keep-${Date.now()}`,
          name: ".cocode-keep",
          path: `${cleanPath}/.cocode-keep`,
          language: "text",
          content: "",
          isFolder: false,
        };
        setFiles((prev) => [...prev, keepItem]);
        setExpandedFolders((prev) => ({ ...prev, [cleanPath]: true }));
        showToast(`Created folder ${name}`);
      } catch (err) {
        alert(err.message || "Failed to create folder.");
      }
    } else {
      const folderItem = {
        id: `folder-${Date.now()}`,
        name,
        path: cleanPath,
        isFolder: true,
      };
      setFiles((prev) => [...prev, folderItem]);
      setExpandedFolders((prev) => ({ ...prev, [cleanPath]: true }));
      showToast(`Created folder ${name}`);
    }
  }

  async function handleRenameItem(item, newName) {
    const parent = item.path.substring(0, item.path.lastIndexOf("/"));
    const newPath = `${parent}/${newName}`.replace(/\/+/g, "/");

    if (item.isFolder) {
      if (projectId && token) {
        try {
          const res = await fetch(`${API_BASE}/api/projects/${projectId}/folders`, {
            method: "PUT",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({ oldPath: item.path, newPath }),
          });

          if (!res.ok) {
            const errData = await res.json().catch(() => ({}));
            throw new Error(errData.error || errData.message || "Failed to rename folder.");
          }

          setFiles((prev) =>
            prev.map((f) => {
              if (f.path === item.path) {
                return { ...f, name: newName, path: newPath };
              }
              if (f.path.startsWith(`${item.path}/`)) {
                return { ...f, path: f.path.replace(item.path, newPath) };
              }
              return f;
            })
          );
          showToast(`Renamed folder to ${newName}`);
        } catch (err) {
          alert(err.message || "Failed to rename folder.");
        }
      } else {
        setFiles((prev) =>
          prev.map((f) => {
            if (f.path === item.path) {
              return { ...f, name: newName, path: newPath };
            }
            if (f.path.startsWith(`${item.path}/`)) {
              return { ...f, path: f.path.replace(item.path, newPath) };
            }
            return f;
          })
        );
      }
    } else {
      // Rename file
      if (projectId && token) {
        try {
          const res = await fetch(`${API_BASE}/api/projects/${projectId}/files/${item.id}`, {
            method: "PUT",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({ name: newName, path: newPath }),
          });

          if (!res.ok) {
            const errData = await res.json().catch(() => ({}));
            throw new Error(errData.error || errData.message || "Failed to rename file.");
          }

          setFiles((prev) =>
            prev.map((f) => (f.id === item.id ? { ...f, name: newName, path: newPath } : f))
          );
          showToast(`Renamed to ${newName}`);
        } catch (err) {
          alert(err.message || "Failed to rename file.");
        }
      } else {
        setFiles((prev) =>
          prev.map((f) => (f.id === item.id ? { ...f, name: newName, path: newPath } : f))
        );
      }
    }
  }

  function confirmDeleteItem(item) {
    const isFolder = item.isFolder;
    setConfirmModal({
      isOpen: true,
      title: isFolder ? `Delete Folder "${item.name}"?` : `Delete File "${item.name}"?`,
      message: isFolder
        ? `Are you sure you want to delete folder "${item.name}" and all of its contents? This action cannot be undone.`
        : `Are you sure you want to delete file "${item.name}"? This action cannot be undone.`,
      confirmText: "Delete",
      confirmVariant: "danger",
      onConfirm: () => performDeleteItem(item),
    });
  }

  async function performDeleteItem(item) {
    setConfirmModal((prev) => ({ ...prev, isOpen: false }));

    if (item.isFolder) {
      if (projectId && token) {
        try {
          const res = await fetch(
            `${API_BASE}/api/projects/${projectId}/folders?path=${encodeURIComponent(item.path)}`,
            {
              method: "DELETE",
              headers: { Authorization: `Bearer ${token}` },
            }
          );
          if (!res.ok) throw new Error("Failed to delete folder.");
        } catch (err) {
          alert(err.message || "Failed to delete folder.");
          return;
        }
      }

      setFiles((prev) =>
        prev.filter((f) => f.path !== item.path && !f.path.startsWith(`${item.path}/`))
      );
      // Close tabs for deleted nested files
      setOpenTabIds((prev) =>
        prev.filter((id) => {
          const f = files.find((itemF) => itemF.id === id);
          return f && !f.path.startsWith(`${item.path}/`) && f.path !== item.path;
        })
      );
      showToast(`Deleted folder ${item.name}`);
    } else {
      if (projectId && token) {
        try {
          const res = await fetch(`${API_BASE}/api/projects/${projectId}/files/${item.id}`, {
            method: "DELETE",
            headers: { Authorization: `Bearer ${token}` },
          });
          if (!res.ok) throw new Error("Failed to delete file.");
        } catch (err) {
          alert(err.message || "Failed to delete file.");
          return;
        }
      }

      setFiles((prev) => prev.filter((f) => f.id !== item.id));
      setOpenTabIds((prev) => prev.filter((id) => id !== item.id));
      if (activeFileId === item.id) {
        const remaining = openTabIds.filter((id) => id !== item.id);
        setActiveFileId(remaining[remaining.length - 1] || null);
      }
      showToast(`Deleted ${item.name}`);
    }
  }

  // Tab management (Phase 8.3)
  function openFile(file) {
    if (!file || file.isFolder) return;
    if (!openTabIds.includes(file.id)) {
      setOpenTabIds((prev) => [...prev, file.id]);
    }
    switchActiveFile(file.id);
  }

  function handleCloseTab(e, tabId) {
    if (e) e.stopPropagation();

    // Check unsaved changes
    if (dirtyFiles[tabId]) {
      const file = files.find((f) => f.id === tabId);
      setConfirmModal({
        isOpen: true,
        title: `Discard Changes in "${file?.name || "file"}"?`,
        message: "You have unsaved changes in this file. Closing this tab will discard them.",
        confirmText: "Discard & Close",
        confirmVariant: "danger",
        onConfirm: () => {
          setConfirmModal((prev) => ({ ...prev, isOpen: false }));
          setDirtyFiles((prev) => {
            const next = { ...prev };
            delete next[tabId];
            return next;
          });
          closeTabFinal(tabId);
        },
      });
      return;
    }

    closeTabFinal(tabId);
  }

  function closeTabFinal(tabId) {
    const remaining = openTabIds.filter((id) => id !== tabId);
    setOpenTabIds(remaining);
    if (activeFileId === tabId) {
      const nextId = remaining[remaining.length - 1] || null;
      switchActiveFile(nextId);
    }
  }

  function closeAllTabs() {
    saveCurrentViewState();
    setOpenTabIds([]);
    setActiveFileId(null);
  }

  function toggleFolder(path, forceOpen) {
    setExpandedFolders((prev) => ({
      ...prev,
      [path]: forceOpen !== undefined ? forceOpen : !prev[path],
    }));
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

  // Download project as ZIP
  async function handleDownloadCode() {
    const zip = new JSZip();
    files.forEach((f) => {
      if (!f.isFolder && f.name !== ".cocode-keep") {
        const cleanPath = f.path.replace(/^\/+/, "");
        zip.file(cleanPath, f.content || "");
      }
    });

    const blob = await zip.generateAsync({ type: "blob" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `cocode-project-${roomId || projectData?.name || "workspace"}.zip`;
    link.click();
    URL.revokeObjectURL(link.href);
    showToast("Downloaded project archive");
  }

  // Execute Code via backend Judge0 compiler API
  const handleRunCode = useCallback(async () => {
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
          projectId: projectId || undefined,
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
  }, [activeFile, token, stdinValue, projectId]);

  // Chat message send (Phase 6)
  function handleSendMessage(e) {
    e.preventDefault();
    if (!chatInput.trim()) return;

    const messageId = `msg-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const newMsg = {
      id: messageId,
      senderId: user?.id || "u-current",
      senderName: user?.name || "Developer",
      text: chatInput.trim(),
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      optimistic: true,
    };

    setChatMessages((prev) => [...prev, newMsg]);
    setChatInput("");

    if (socketRef.current && roomId) {
      socketRef.current.emit("chat-message", {
        roomCode: roomId,
        id: messageId,
        text: newMsg.text,
        message: newMsg,
      });
    }
  }

  // Project-wide Search (Phase 8.4)
  const performProjectSearch = useCallback(async () => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      return;
    }

    setIsSearching(true);
    if (projectId && token) {
      try {
        const queryParams = new URLSearchParams({
          q: searchQuery.trim(),
          matchCase: matchCase ? "true" : "false",
          wholeWord: wholeWord ? "true" : "false",
        });

        const res = await fetch(`${API_BASE}/api/projects/${projectId}/search?${queryParams.toString()}`, {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (res.ok) {
          const data = await res.json();
          setSearchResults(data.matches || []);
        }
      } catch (err) {
        console.warn("Server search failed, falling back to local:", err);
      } finally {
        setIsSearching(false);
      }
    } else {
      // Local search across loaded project files
      const q = matchCase ? searchQuery : searchQuery.toLowerCase();
      const results = [];

      files.forEach((f) => {
        if (f.isFolder || f.name === ".cocode-keep") return;
        const lines = (f.content || "").split("\n");
        lines.forEach((line, lineIdx) => {
          const target = matchCase ? line : line.toLowerCase();
          if (target.includes(q)) {
            results.push({
              fileId: f.id,
              fileName: f.name,
              filePath: f.path,
              lineNumber: lineIdx + 1,
              lineContent: line.trim(),
            });
          }
        });
      });

      setSearchResults(results);
      setIsSearching(false);
    }
  }, [searchQuery, matchCase, wholeWord, projectId, token, files]);

  useEffect(() => {
    const timer = setTimeout(() => {
      performProjectSearch();
    }, 250);
    return () => clearTimeout(timer);
  }, [performProjectSearch]);

  // Global Keyboard Shortcuts Listener (Phase 8.7)
  useEffect(() => {
    function handleGlobalKeyDown(e) {
      const isMac = navigator.platform.toUpperCase().indexOf("MAC") >= 0;
      const mod = isMac ? e.metaKey : e.ctrlKey;

      // Ctrl + S : Save current file
      if (mod && !e.shiftKey && e.key.toLowerCase() === "s") {
        e.preventDefault();
        saveCurrentFile();
      }
      // Ctrl + Shift + S : Save all open files
      else if (mod && e.shiftKey && e.key.toLowerCase() === "s") {
        e.preventDefault();
        saveAllFiles();
      }
      // Ctrl + P : Quick Open
      else if (mod && !e.shiftKey && e.key.toLowerCase() === "p") {
        e.preventDefault();
        setIsQuickOpenOpen(true);
      }
      // Ctrl + Shift + P or F1 : Command Palette
      else if ((mod && e.shiftKey && e.key.toLowerCase() === "p") || e.key === "F1") {
        e.preventDefault();
        setIsCommandPaletteOpen(true);
      }
      // Ctrl + F : Find
      else if (mod && !e.shiftKey && e.key.toLowerCase() === "f") {
        e.preventDefault();
        setIsFindOpen(true);
      }
      // Ctrl + H : Replace
      else if (mod && !e.shiftKey && e.key.toLowerCase() === "h") {
        e.preventDefault();
        setIsFindOpen(true);
      }
      // Ctrl + Shift + F : Search in project
      else if (mod && e.shiftKey && e.key.toLowerCase() === "f") {
        e.preventDefault();
        setActiveActivityTab("search");
      }
      // Ctrl + B : Toggle explorer
      else if (mod && !e.shiftKey && e.key.toLowerCase() === "b") {
        e.preventDefault();
        setActiveActivityTab((cur) => (cur === "files" ? null : "files"));
      }
      // Ctrl + ` : Toggle Terminal bottom panel
      else if (mod && e.key === "`") {
        e.preventDefault();
        setIsBottomPanelCollapsed((cur) => !cur);
      }
      // Alt + Shift + F : Format Document
      else if (e.altKey && e.shiftKey && e.key.toLowerCase() === "f") {
        e.preventDefault();
        formatDocument();
      }
      // Ctrl + Enter : Run Code
      else if (mod && e.key === "Enter") {
        e.preventDefault();
        handleRunCode();
      }
      // Ctrl + W : Close active tab
      else if (mod && !e.shiftKey && e.key.toLowerCase() === "w") {
        e.preventDefault();
        if (activeFileId) {
          handleCloseTab(null, activeFileId);
        }
      }
    }

    window.addEventListener("keydown", handleGlobalKeyDown);
    return () => window.removeEventListener("keydown", handleGlobalKeyDown);
  }, [saveCurrentFile, saveAllFiles, formatDocument, activeFileId]);

  // Leave room action (Phase 6)
  function handleLeaveRoom() {
    if (yBindingRef.current) {
      try {
        yBindingRef.current.destroy();
      } catch {}
      yBindingRef.current = null;
    }
    yDocsRef.current.clear();

    if (socketRef.current) {
      socketRef.current.emit("room:leave");
      socketRef.current.disconnect();
    }
    navigate("/rooms/join");
  }

  // Copy room code
  async function copyRoomCode() {
    if (!roomId) return;
    try {
      await navigator.clipboard.writeText(roomId);
      setRoomCopied(true);
      setTimeout(() => setRoomCopied(false), 2000);
    } catch {
      alert(`Room code: ${roomId}`);
    }
  }

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

  // Command Palette items list (Phase 8.7)
  const paletteCommands = useMemo(() => {
    return [
      {
        id: "cmd-new-file",
        label: "New File",
        category: "File",
        shortcut: "Ctrl+N",
        icon: <FilePlus size={14} className="text-sky" />,
        action: () => {
          setActiveActivityTab("files");
          const name = prompt("Enter file name (e.g. script.js):");
          if (name) handleCreateFile("", name);
        },
      },
      {
        id: "cmd-new-folder",
        label: "New Folder",
        category: "File",
        icon: <FolderPlus size={14} className="text-sky" />,
        action: () => {
          setActiveActivityTab("files");
          const name = prompt("Enter folder name (e.g. utils):");
          if (name) handleCreateFolder("", name);
        },
      },
      {
        id: "cmd-save",
        label: "Save File",
        category: "File",
        shortcut: "Ctrl+S",
        icon: <Save size={14} className="text-sky" />,
        action: saveCurrentFile,
      },
      {
        id: "cmd-save-all",
        label: "Save All Files",
        category: "File",
        shortcut: "Ctrl+Shift+S",
        icon: <Save size={14} className="text-emerald" />,
        action: saveAllFiles,
      },
      {
        id: "cmd-quick-open",
        label: "Quick Open File",
        category: "File",
        shortcut: "Ctrl+P",
        icon: <Files size={14} className="text-amber" />,
        action: () => setIsQuickOpenOpen(true),
      },
      {
        id: "cmd-find",
        label: "Find in Current File",
        category: "Edit",
        shortcut: "Ctrl+F",
        icon: <Search size={14} className="text-sky" />,
        action: () => setIsFindOpen(true),
      },
      {
        id: "cmd-format",
        label: "Format Document",
        category: "Edit",
        shortcut: "Alt+Shift+F",
        icon: <Wrench size={14} className="text-sky" />,
        action: formatDocument,
      },
      {
        id: "cmd-project-search",
        label: "Search across Project",
        category: "Search",
        shortcut: "Ctrl+Shift+F",
        icon: <Search size={14} className="text-cyan" />,
        action: () => setActiveActivityTab("search"),
      },
      {
        id: "cmd-run-code",
        label: "Run Code",
        category: "Run",
        shortcut: "Ctrl+Enter",
        icon: <Play size={14} className="text-emerald" />,
        action: handleRunCode,
      },
      {
        id: "cmd-toggle-terminal",
        label: "Toggle Integrated Terminal",
        category: "View",
        shortcut: "Ctrl+`",
        icon: <Terminal size={14} className="text-sky" />,
        action: () => {
          setIsBottomPanelCollapsed((cur) => !cur);
          setBottomPanelTab("terminal");
        },
      },
      {
        id: "cmd-toggle-explorer",
        label: "Toggle File Explorer",
        category: "View",
        shortcut: "Ctrl+B",
        icon: <Files size={14} className="text-slate" />,
        action: () => setActiveActivityTab((cur) => (cur === "files" ? null : "files")),
      },
      {
        id: "cmd-close-tab",
        label: "Close Current Tab",
        category: "Tab",
        shortcut: "Ctrl+W",
        icon: <X size={14} className="text-rose" />,
        action: () => {
          if (activeFileId) handleCloseTab(null, activeFileId);
        },
      },
      {
        id: "cmd-close-all-tabs",
        label: "Close All Tabs",
        category: "Tab",
        icon: <X size={14} className="text-rose" />,
        action: closeAllTabs,
      },
      {
        id: "cmd-toggle-minimap",
        label: "Toggle Minimap",
        category: "Settings",
        icon: <Sliders size={14} className="text-sky" />,
        action: () =>
          setEditorSettings((prev) => ({ ...prev, minimap: !prev.minimap })),
      },
      {
        id: "cmd-toggle-wordwrap",
        label: "Toggle Word Wrap",
        category: "Settings",
        icon: <Sliders size={14} className="text-sky" />,
        action: () =>
          setEditorSettings((prev) => ({
            ...prev,
            wordWrap: prev.wordWrap === "on" ? "off" : "on",
          })),
      },
      {
        id: "cmd-download-zip",
        label: "Download Project ZIP",
        category: "Project",
        icon: <Download size={14} className="text-sky" />,
        action: handleDownloadCode,
      },
    ];
  }, [saveCurrentFile, saveAllFiles, formatDocument, handleRunCode, activeFileId]);

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
            <strong>{roomId ? `Room ${roomId}` : projectData?.name || "Workspace"}</strong>
            {roomId && (
              <button
                className="ide-icon-btn"
                style={{ padding: "2px 4px", marginLeft: 4 }}
                onClick={copyRoomCode}
                title="Copy Room Code"
              >
                {roomCopied ? <CheckCircle2 size={11} color="#10b981" /> : <Copy size={11} />}
              </button>
            )}
          </div>

          {/* Save Status Indicator Badge (Phase 8.7) */}
          <div
            className={`ide-save-indicator ${saveStatus}`}
            onClick={saveStatus === "unsaved" || saveStatus === "error" ? saveCurrentFile : undefined}
            title={
              saveStatus === "saving"
                ? "Saving..."
                : saveStatus === "unsaved"
                ? "Click to Save (Ctrl+S)"
                : saveStatus === "error"
                ? "Failed to save. Click to retry."
                : "All changes saved"
            }
          >
            {saveStatus === "saved" && <Check size={12} />}
            {saveStatus === "saving" && <RefreshCw size={12} className="spin" />}
            {saveStatus === "unsaved" && <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#f59e0b" }} />}
            {saveStatus === "error" && <AlertTriangle size={12} />}
            <span>
              {saveStatus === "saved"
                ? "Saved"
                : saveStatus === "saving"
                ? "Saving..."
                : saveStatus === "unsaved"
                ? "Unsaved"
                : "Save Error"}
            </span>
          </div>

          {roomId && (
            <div
              className="ide-collab-badge"
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                padding: "2px 8px",
                borderRadius: 4,
                fontSize: 11,
                background:
                  connectionStatus === "connected"
                    ? "rgba(16, 185, 129, 0.12)"
                    : connectionStatus === "connecting" || connectionStatus === "reconnecting"
                    ? "rgba(245, 158, 11, 0.12)"
                    : "rgba(239, 68, 68, 0.12)",
                color:
                  connectionStatus === "connected"
                    ? "#34d399"
                    : connectionStatus === "connecting" || connectionStatus === "reconnecting"
                    ? "#fbbf24"
                    : "#f87171",
              }}
              title={`Connection status: ${connectionStatus}`}
            >
              <span
                style={{
                  display: "inline-block",
                  width: 7,
                  height: 7,
                  borderRadius: "50%",
                  backgroundColor:
                    connectionStatus === "connected"
                      ? "#10b981"
                      : connectionStatus === "connecting" || connectionStatus === "reconnecting"
                      ? "#f59e0b"
                      : "#ef4444",
                }}
              />
              <span>
                {connectionStatus === "connected"
                  ? `${collaborators.length} Online`
                  : connectionStatus === "connecting"
                  ? "Connecting..."
                  : connectionStatus === "reconnecting"
                  ? "Reconnecting..."
                  : connectionStatus === "error"
                  ? "Offline"
                  : "Disconnected"}
              </span>
            </div>
          )}
        </div>

        <div className="ide-topbar-center">
          {projectData && (
            <span style={{ fontSize: "12px", color: "#818cf8", fontWeight: 600, marginRight: "8px" }}>
              {projectData.name} /
            </span>
          )}
          {activeFile && (
            <div className="ide-project-title-badge">
              {renderLanguageBadge(activeFile.language)}
              <span>{activeFile.name}</span>
            </div>
          )}
        </div>

        <div className="ide-topbar-right">
          {/* Quick Command Palette Button */}
          <button
            type="button"
            className="ide-btn-header-secondary"
            onClick={() => setIsCommandPaletteOpen(true)}
            title="Command Palette (Ctrl+Shift+P)"
          >
            <Sliders size={13} />
            <span>Commands</span>
          </button>

          {/* Quick File Open */}
          <button
            type="button"
            className="ide-btn-header-secondary"
            onClick={() => setIsQuickOpenOpen(true)}
            title="Quick Open (Ctrl+P)"
          >
            <Files size={13} />
            <span>Open</span>
          </button>

          {isExecuting ? (
            <button className="ide-btn-header-stop" onClick={() => setIsExecuting(false)}>
              <Square size={13} fill="currentColor" />
              <span>Stop</span>
            </button>
          ) : (
            <button className="ide-btn-header-run" onClick={handleRunCode} title="Run Code (Ctrl+Enter)">
              <Play size={13} fill="currentColor" />
              <span>Run</span>
            </button>
          )}

          <button
            className="ide-btn-header-secondary"
            onClick={saveCurrentFile}
            title="Save File (Ctrl+S)"
            style={{
              borderColor: dirtyFiles[activeFileId] ? "#f59e0b" : undefined,
              color: dirtyFiles[activeFileId] ? "#fbbf24" : undefined,
            }}
          >
            <span>
              {saveStatus === "saving"
                ? "Saving..."
                : dirtyFiles[activeFileId]
                ? "● Save"
                : "Save"}
            </span>
          </button>

          <button
            className="ide-btn-header-secondary"
            onClick={() => setActiveActivityTab("teams")}
            title="Share Room"
          >
            <Share2 size={13} />
            <span>Share</span>
          </button>

          {roomId && (
            <button
              className="ide-btn-header-secondary"
              onClick={handleLeaveRoom}
              title="Leave Room"
              style={{ color: "#f87171" }}
            >
              <LogOut size={13} />
              <span>Leave</span>
            </button>
          )}
        </div>
      </header>

      {/* Optional Toast Banner */}
      {toastMessage && (
        <div
          style={{
            position: "fixed",
            bottom: "20px",
            right: "24px",
            zIndex: 2000,
            background: "#0f172a",
            border: "1px solid #38bdf8",
            borderRadius: "6px",
            padding: "8px 16px",
            color: "#f8fafc",
            fontSize: "12px",
            boxShadow: "0 10px 25px rgba(0, 0, 0, 0.5)",
            display: "flex",
            alignItems: "center",
            gap: "8px",
          }}
        >
          <CheckCircle2 size={14} color="#38bdf8" />
          <span>{toastMessage}</span>
        </div>
      )}

      {roomError && (
        <div
          style={{
            padding: "6px 14px",
            background: "rgba(239, 68, 68, 0.15)",
            borderBottom: "1px solid rgba(239, 68, 68, 0.3)",
            color: "#fca5a5",
            fontSize: 12,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <AlertCircle size={14} color="#ef4444" />
            <span>{roomError}</span>
          </div>
          <button
            style={{ background: "none", border: "none", color: "#fca5a5", cursor: "pointer" }}
            onClick={() => setRoomError(null)}
          >
            <X size={14} />
          </button>
        </div>
      )}

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
              title="File Explorer (Ctrl+B)"
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
              className={`ide-activity-btn ${activeActivityTab === "chat" ? "active" : ""}`}
              onClick={() => setActiveActivityTab(activeActivityTab === "chat" ? null : "chat")}
              title="Team Chat"
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
            {/* Panel 1: File Explorer (Phase 8.2) */}
            {activeActivityTab === "files" && (
              <>
                <div className="ide-sidebar-header">
                  <span className="ide-sidebar-title">Files</span>
                  <div className="ide-sidebar-actions">
                    <button
                      className="ide-icon-btn"
                      onClick={() => {
                        const name = prompt("Enter file name (e.g. index.js):");
                        if (name) handleCreateFile("", name);
                      }}
                      title="New File"
                    >
                      <FilePlus size={16} />
                    </button>
                    <button
                      className="ide-icon-btn"
                      onClick={() => {
                        const name = prompt("Enter folder name (e.g. components):");
                        if (name) handleCreateFolder("", name);
                      }}
                      title="New Folder"
                    >
                      <FolderPlus size={16} />
                    </button>
                    <button
                      className="ide-icon-btn"
                      onClick={fetchProjectData}
                      title="Refresh Files"
                    >
                      <RefreshCw size={14} />
                    </button>
                  </div>
                </div>

                <div className="ide-sidebar-content">
                  <FileTree
                    files={files}
                    activeFileId={activeFileId}
                    dirtyFiles={dirtyFiles}
                    expandedFolders={expandedFolders}
                    onToggleFolder={toggleFolder}
                    onOpenFile={openFile}
                    onCreateFile={handleCreateFile}
                    onCreateFolder={handleCreateFolder}
                    onRenameItem={handleRenameItem}
                    onDeleteItem={confirmDeleteItem}
                    onRefresh={fetchProjectData}
                  />
                </div>

                {/* Bottom 3 Action Buttons */}
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

            {/* Panel 2: Project-Wide Search (Phase 8.4) */}
            {activeActivityTab === "search" && (
              <div className="ide-panel-view">
                <div className="ide-panel-heading">
                  <Search size={16} color="#38bdf8" />
                  <span>Search in Project</span>
                </div>
                <div className="ide-form-group">
                  <input
                    className="ide-input-text"
                    placeholder="Search term across files (Ctrl+Shift+F)..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    autoFocus
                  />
                  <div style={{ display: "flex", gap: 12, marginTop: 4 }}>
                    <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, color: "#94a3b8", cursor: "pointer" }}>
                      <input
                        type="checkbox"
                        checked={matchCase}
                        onChange={(e) => setMatchCase(e.target.checked)}
                      />
                      Match Case
                    </label>
                    <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, color: "#94a3b8", cursor: "pointer" }}>
                      <input
                        type="checkbox"
                        checked={wholeWord}
                        onChange={(e) => setWholeWord(e.target.checked)}
                      />
                      Whole Word
                    </label>
                  </div>
                </div>

                <div style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", gap: 6 }}>
                  {isSearching ? (
                    <div style={{ color: "#38bdf8", fontSize: 12 }}>Searching project...</div>
                  ) : searchResults.length === 0 && searchQuery ? (
                    <div style={{ color: "#64748b", fontSize: 12 }}>No matches found in project.</div>
                  ) : (
                    searchResults.map((res, i) => (
                      <div
                        key={i}
                        className="ide-tree-item"
                        style={{ flexDirection: "column", alignItems: "flex-start", gap: 2 }}
                        onClick={() => {
                          const targetFile = files.find((f) => f.id === res.fileId || f.path === res.filePath);
                          if (targetFile) {
                            openFile(targetFile);
                            if (editorRef.current) {
                              setTimeout(() => {
                                editorRef.current.revealLineInCenter(res.lineNumber);
                                editorRef.current.setPosition({ lineNumber: res.lineNumber, column: 1 });
                              }, 80);
                            }
                          }
                        }}
                      >
                        <div style={{ display: "flex", gap: 6, alignItems: "center", width: "100%" }}>
                          <span style={{ color: "#38bdf8", fontWeight: 600 }}>{res.fileName}</span>
                          <span style={{ color: "#64748b", fontSize: 11 }}>:{res.lineNumber}</span>
                          <span style={{ color: "#475569", fontSize: 10, marginLeft: "auto" }}>{res.filePath}</span>
                        </div>
                        <div style={{ color: "#cbd5e1", fontSize: 11, fontFamily: "monospace" }}>
                          {res.lineContent || res.lineText}
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

            {/* Panel 4: Real-time Room Chat (Phase 6) */}
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

            {/* Panel 5: Activity Analytics */}
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

            {/* Panel 6: Teams & Collaborators */}
            {activeActivityTab === "teams" && (
              <div className="ide-panel-view">
                <div className="ide-panel-heading">
                  <Users size={16} color="#38bdf8" />
                  <span>Collaborators</span>
                </div>

                <div style={{ marginBottom: 12, background: "#111827", padding: 10, borderRadius: 6 }}>
                  <div style={{ fontSize: 11, color: "#94a3b8", marginBottom: 4 }}>ROOM CODE</div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <strong style={{ fontSize: 15, color: "#38bdf8", letterSpacing: "1px" }}>{roomId || "SOLO"}</strong>
                    <button
                      className="ide-icon-btn"
                      onClick={copyRoomCode}
                      title="Copy code"
                    >
                      {roomCopied ? <CheckCircle2 size={13} color="#10b981" /> : <Copy size={13} />}
                    </button>
                  </div>
                  {roomCopied && (
                    <div style={{ fontSize: 11, color: "#34d399", marginTop: 4 }}>
                      ✓ Code copied to clipboard!
                    </div>
                  )}
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

            {/* Panel 7: Editor Settings (Phase 8.7) */}
            {activeActivityTab === "settings" && (
              <div className="ide-panel-view">
                <div className="ide-panel-heading">
                  <Settings size={16} color="#38bdf8" />
                  <span>Editor Preferences</span>
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
                  <label className="ide-form-label">Theme</label>
                  <select
                    className="ide-input-text"
                    value={editorSettings.theme}
                    onChange={(e) =>
                      setEditorSettings((prev) => ({ ...prev, theme: e.target.value }))
                    }
                  >
                    <option value="cocode-dark">CoCode Dark (Default)</option>
                    <option value="vs-dark">VS Dark</option>
                  </select>
                </div>

                <div className="ide-form-group">
                  <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, cursor: "pointer" }}>
                    <input
                      type="checkbox"
                      checked={editorSettings.autoSave}
                      onChange={(e) =>
                        setEditorSettings((prev) => ({ ...prev, autoSave: e.target.checked }))
                      }
                    />
                    Enable Autosave
                  </label>
                </div>

                {editorSettings.autoSave && (
                  <div className="ide-form-group">
                    <label className="ide-form-label">Autosave Delay</label>
                    <select
                      className="ide-input-text"
                      value={editorSettings.autoSaveDelay || 1500}
                      onChange={(e) =>
                        setEditorSettings((prev) => ({ ...prev, autoSaveDelay: Number(e.target.value) }))
                      }
                    >
                      <option value="1000">1.0 second</option>
                      <option value="1500">1.5 seconds</option>
                      <option value="3000">3.0 seconds</option>
                    </select>
                  </div>
                )}

                <div className="ide-form-group">
                  <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, cursor: "pointer" }}>
                    <input
                      type="checkbox"
                      checked={editorSettings.formatOnSave}
                      onChange={(e) =>
                        setEditorSettings((prev) => ({ ...prev, formatOnSave: e.target.checked }))
                      }
                    />
                    Format on Save
                  </label>
                </div>

                <div className="ide-form-group">
                  <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, cursor: "pointer" }}>
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

            {/* Panel 8: Developer Tools */}
            {activeActivityTab === "devtools" && (
              <div className="ide-panel-view">
                <div className="ide-panel-heading">
                  <Wrench size={16} color="#38bdf8" />
                  <span>Developer Tools</span>
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  <button className="ide-pill-action-btn" onClick={formatDocument}>
                    <span>Format Document</span>
                  </button>

                  <button className="ide-pill-action-btn" onClick={() => setIsCommandPaletteOpen(true)}>
                    <span>Open Command Palette (F1)</span>
                  </button>

                  <div style={{ background: "#111827", padding: 12, borderRadius: 6, marginTop: 10 }}>
                    <div style={{ color: "#cbd5e1", fontSize: 12, fontWeight: 600, marginBottom: 6 }}>
                      Keyboard Shortcuts
                    </div>
                    <ul style={{ margin: 0, paddingLeft: 16, fontSize: 11, color: "#94a3b8", lineHeight: 1.6 }}>
                      <li><strong style={{ color: "#f8fafc" }}>Ctrl + S</strong> : Save File</li>
                      <li><strong style={{ color: "#f8fafc" }}>Ctrl + Shift + S</strong> : Save All</li>
                      <li><strong style={{ color: "#f8fafc" }}>Ctrl + P</strong> : Quick Open File</li>
                      <li><strong style={{ color: "#f8fafc" }}>Ctrl + Shift + P</strong> : Command Palette</li>
                      <li><strong style={{ color: "#f8fafc" }}>Ctrl + F</strong> : Find</li>
                      <li><strong style={{ color: "#f8fafc" }}>Ctrl + H</strong> : Replace</li>
                      <li><strong style={{ color: "#f8fafc" }}>Ctrl + Shift + F</strong> : Search in Project</li>
                      <li><strong style={{ color: "#f8fafc" }}>Ctrl + B</strong> : Toggle Explorer</li>
                      <li><strong style={{ color: "#f8fafc" }}>Ctrl + `</strong> : Toggle Terminal</li>
                      <li><strong style={{ color: "#f8fafc" }}>Alt + Shift + F</strong> : Format Document</li>
                      <li><strong style={{ color: "#f8fafc" }}>Ctrl + Enter</strong> : Run Code</li>
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
          {/* Multi-Tab Bar (Phase 8.3) */}
          <div className="ide-tabs-bar">
            {openTabIds.map((tabId) => {
              const file = files.find((f) => f.id === tabId);
              if (!file) return null;
              const isActive = activeFileId === tabId;
              const isDirty = Boolean(dirtyFiles[tabId]);

              return (
                <div
                  key={tabId}
                  className={`ide-tab ${isActive ? "active" : ""}`}
                  onClick={() => switchActiveFile(tabId)}
                  title={file.path}
                >
                  {renderLanguageBadge(file.language)}
                  <span className="ide-tab-name">{file.name}</span>
                  {isDirty ? (
                    <span
                      className="ide-tab-dirty-dot"
                      title="Unsaved changes. Click to close."
                      onClick={(e) => handleCloseTab(e, tabId)}
                    />
                  ) : (
                    <button
                      type="button"
                      className="ide-tab-close"
                      onClick={(e) => handleCloseTab(e, tabId)}
                      title="Close Tab (Ctrl+W)"
                    >
                      <X size={12} />
                    </button>
                  )}
                </div>
              );
            })}

            <button
              type="button"
              className="ide-tab-add-btn"
              onClick={() => {
                const name = prompt("Enter new file name (e.g. index.js):");
                if (name) handleCreateFile("", name);
              }}
              title="Add File"
            >
              <Plus size={14} />
            </button>
          </div>

          {/* Monaco Editor Surface with Find/Replace Overlay */}
          <div className="ide-editor-workspace">
            {/* Find & Replace Floating Widget (Phase 8.4) */}
            <FindReplaceWidget
              isOpen={isFindOpen}
              onClose={() => setIsFindOpen(false)}
              editor={editorRef.current}
            />

            {activeFile ? (
              <Editor
                key="cocode-monaco-editor"
                path={activeFile.path || activeFile.id}
                height="100%"
                language={activeFile.language || "javascript"}
                value={roomId ? undefined : (activeFile.content || "")}
                defaultValue={activeFile.content || ""}
                theme={editorSettings.theme || "cocode-dark"}
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
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100%", color: "#64748b", gap: 12 }}>
                <p>Select or create a file from the explorer to begin editing.</p>
                <button
                  type="button"
                  className="ide-btn-create-sample"
                  onClick={() => setIsQuickOpenOpen(true)}
                >
                  <Files size={14} />
                  <span>Open File (Ctrl+P)</span>
                </button>
              </div>
            )}

            {/* Floating pill: "CoCode • Collaborate in real time" */}
            <div className="ide-floating-collab-pill">
              <span>CoCode</span> • Collaborate in real time
            </div>
          </div>

          {/* Resizable Bottom Panel (Phase 8.6: Terminal, Output, Stdin, History) */}
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
                  type="button"
                  className={`ide-panel-tab ${bottomPanelTab === "terminal" ? "active" : ""}`}
                  onClick={() => {
                    setBottomPanelTab("terminal");
                    setIsBottomPanelCollapsed(false);
                  }}
                >
                  <Terminal size={13} />
                  <span>Terminal</span>
                </button>
                <button
                  type="button"
                  className={`ide-panel-tab ${bottomPanelTab === "output" ? "active" : ""}`}
                  onClick={() => {
                    setBottomPanelTab("output");
                    setIsBottomPanelCollapsed(false);
                  }}
                >
                  <Play size={13} />
                  <span>Output</span>
                </button>
                <button
                  type="button"
                  className={`ide-panel-tab ${bottomPanelTab === "stdin" ? "active" : ""}`}
                  onClick={() => {
                    setBottomPanelTab("stdin");
                    setIsBottomPanelCollapsed(false);
                  }}
                >
                  <span>Input (stdin)</span>
                </button>
                <button
                  type="button"
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
                  type="button"
                  className="ide-icon-btn"
                  onClick={() => {
                    if (executionOutput.stdout) {
                      navigator.clipboard.writeText(executionOutput.stdout);
                      showToast("Output copied");
                    }
                  }}
                  title="Copy Output"
                >
                  <Copy size={13} />
                </button>
                <button
                  type="button"
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
                  type="button"
                  className="ide-icon-btn"
                  onClick={() => setIsBottomPanelCollapsed(!isBottomPanelCollapsed)}
                  title={isBottomPanelCollapsed ? "Expand Panel (Ctrl+`)" : "Collapse Panel (Ctrl+`)"}
                >
                  {isBottomPanelCollapsed ? <ChevronRight size={14} style={{ transform: "rotate(-90deg)" }} /> : <X size={14} />}
                </button>
              </div>
            </div>

            {!isBottomPanelCollapsed && (
              <div className="ide-bottom-panel-body">
                {/* Tab 1: Terminal Console Foundation (Phase 8.6) */}
                {bottomPanelTab === "terminal" && (
                  <TerminalConsole
                    activeFile={activeFile}
                    files={files}
                    projectName={roomId ? `Room ${roomId}` : projectData?.name || "Workspace"}
                    userName={user?.name || "developer"}
                    onRunCode={handleRunCode}
                    isExecuting={isExecuting}
                  />
                )}

                {/* Tab 2: Code Execution Output */}
                {bottomPanelTab === "output" && (
                  <div>
                    {isExecuting && (
                      <div style={{ color: "#38bdf8", marginBottom: 8 }}>
                        ⚡ Executing program on Judge0 isolated runner...
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
                      <div style={{ color: "#64748b" }}>Click "Run" or type 'run' in Terminal to compile and execute program.</div>
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

                {/* Tab 3: Stdin */}
                {bottomPanelTab === "stdin" && (
                  <textarea
                    className="ide-stdin-textarea"
                    placeholder="Enter standard input (stdin) passed to your program on execution..."
                    value={stdinValue}
                    onChange={(e) => setStdinValue(e.target.value)}
                  />
                )}

                {/* Tab 4: Execution History */}
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

      {/* Command Palette Modal (Phase 8.7) */}
      <CommandPalette
        isOpen={isCommandPaletteOpen}
        onClose={() => setIsCommandPaletteOpen(false)}
        commands={paletteCommands}
      />

      {/* Quick Open File Modal (Phase 8.7) */}
      <QuickOpen
        isOpen={isQuickOpenOpen}
        onClose={() => setIsQuickOpenOpen(false)}
        files={files}
        onSelectFile={openFile}
      />

      {/* Confirm Action Modal */}
      <ConfirmModal
        isOpen={confirmModal.isOpen}
        title={confirmModal.title}
        message={confirmModal.message}
        confirmText={confirmModal.confirmText}
        confirmVariant={confirmModal.confirmVariant}
        onConfirm={confirmModal.onConfirm}
        onCancel={() => setConfirmModal((prev) => ({ ...prev, isOpen: false }))}
      />
    </div>
  );
}
