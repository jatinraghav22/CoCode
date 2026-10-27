import React, { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { Link } from "react-router-dom";
import Editor from "@monaco-editor/react";
import JSZip from "jszip";
import {
  Files,
  Search,
  History,
  Play,
  Square,
  Sparkles,
  TrendingUp,
  Settings as SettingsIcon,
  Wrench,
  FilePlus,
  FolderPlus,
  Upload,
  FolderUp,
  Download,
  X,
  ChevronRight,
  Trash2,
  Edit2,
  Copy,
  Terminal,
  AlertCircle,
  AlertTriangle,
  RotateCcw,
  Maximize2,
  Minimize2,
  Check,
  Code2,
  Clock,
} from "lucide-react";
import "./Compiler.css";

const API_BASE = (import.meta.env.VITE_API_URL || "http://localhost:5000").replace(/\/+$/, "");
const STORAGE_KEY_FILES = "cocode_compiler_workspace_files_v1";
const STORAGE_KEY_SETTINGS = "cocode_compiler_settings_v1";
const STORAGE_KEY_HISTORY = "cocode_compiler_code_revisions_v1";

// Default starter files for standalone workspace
const DEFAULT_FILES = [
  {
    id: "f-index-js",
    name: "index.js",
    path: "/index.js",
    language: "javascript",
    isFolder: false,
    content: `// CoCode Standalone Compiler
// Instant execution in Node.js 22 runtime

function greet(name, role) {
  return {
    message: \`Hello, \${name}!\`,
    role: role,
    timestamp: new Date().toISOString(),
    status: "READY"
  };
}

const developer = greet("Guest Developer", "CoCode Engineer");
console.log("CoCode Workspace Initialized:");
console.log(JSON.stringify(developer, null, 2));

// Quick calculation demo
const fib = (n) => (n <= 1 ? n : fib(n - 1) + fib(n - 2));
console.log("\\nFibonacci(10) =", fib(10));
`,
  },
  {
    id: "f-main-py",
    name: "main.py",
    path: "/main.py",
    language: "python",
    isFolder: false,
    content: `# CoCode Python Runtime (Python 3.12)
import sys

def sieve(limit):
    is_prime = [True] * (limit + 1)
    is_prime[0] = is_prime[1] = False
    for i in range(2, int(limit**0.5) + 1):
        if is_prime[i]:
            for j in range(i*i, limit + 1, i):
                is_prime[j] = False
    return [x for x in range(limit + 1) if is_prime[x]]

primes = sieve(50)
print(f"Discovered {len(primes)} primes up to 50:")
print(primes)
print(f"Python interpreter: {sys.version.split()[0]}")
`,
  },
  {
    id: "f-calc-cpp",
    name: "calculator.cpp",
    path: "/calculator.cpp",
    language: "cpp",
    isFolder: false,
    content: `#include <iostream>
#include <vector>
#include <numeric>

int main() {
    std::cout << "=== CoCode C++ (GCC 14.1) ===" << std::endl;
    std::vector<int> numbers = {10, 20, 30, 40, 50};
    
    int sum = std::accumulate(numbers.begin(), numbers.end(), 0);
    double avg = static_cast<double>(sum) / numbers.size();
    
    std::cout << "Numbers processed: " << numbers.size() << std::endl;
    std::cout << "Sum: " << sum << " | Average: " << avg << std::endl;
    return 0;
}
`,
  },
  {
    id: "f-hello-c",
    name: "hello.c",
    path: "/hello.c",
    language: "c",
    isFolder: false,
    content: `#include <stdio.h>

int main(void) {
    printf("=== CoCode C Runtime (GCC 14.1) ===\\n");
    printf("Execution successful with zero configuration.\\n");
    return 0;
}
`,
  },
  {
    id: "f-main-java",
    name: "Main.java",
    path: "/Main.java",
    language: "java",
    isFolder: false,
    content: `// Main class for CoCode Java (OpenJDK 17)
public class Main {
    public static void main(String[] args) {
        System.out.println("=== CoCode Java Runtime (OpenJDK 17) ===");
        System.out.println("Welcome to the browser-based IDE.");
        
        long total = 0;
        for (int i = 1; i <= 100; i++) {
            total += i;
        }
        System.out.println("Sum of 1 to 100 = " + total);
    }
}
`,
  },
  {
    id: "f-styles-css",
    name: "styles.css",
    path: "/styles.css",
    language: "css",
    isFolder: false,
    content: `/* Modern Dark Styling */
:root {
  --primary-color: #38bdf8;
  --bg-dark: #0d1117;
  --text-main: #f0f6fc;
}

body {
  background: var(--bg-dark);
  color: var(--text-main);
  font-family: 'Inter', system-ui, sans-serif;
  margin: 0;
  padding: 1.5rem;
}
`,
  },
];

const DEFAULT_SETTINGS = {
  theme: "cocode-dark",
  fontSize: 14,
  tabSize: 4,
  wordWrap: "on",
  minimap: true,
  lineNumbers: "on",
  autoSave: true,
};

// Map file extensions to Monaco language identifiers
function getLanguageFromFilename(filename) {
  const ext = filename.split(".").pop().toLowerCase();
  switch (ext) {
    case "js":
    case "jsx":
    case "mjs":
      return "javascript";
    case "py":
      return "python";
    case "cpp":
    case "cc":
    case "cxx":
    case "hpp":
    case "h":
      return "cpp";
    case "c":
      return "c";
    case "java":
      return "java";
    case "html":
    case "htm":
      return "html";
    case "css":
      return "css";
    case "json":
      return "json";
    case "md":
      return "markdown";
    case "txt":
      return "plaintext";
    default:
      return "plaintext";
  }
}

// Can this file be executed on the backend?
function isRunnableLanguage(lang) {
  return ["javascript", "python", "cpp", "c", "java"].includes(lang);
}

export default function Compiler() {
  // Activity Bar Tab: 'files' | 'search' | 'history' | 'run' | 'ai' | 'analytics' | 'settings' | 'devtools'
  const [activeActivityTab, setActiveActivityTab] = useState("files");

  // Local Workspace Files
  const [files, setFiles] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_FILES);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch (e) {
      console.warn("Could not load saved workspace files:", e);
    }
    return DEFAULT_FILES;
  });

  // Open tabs and active file
  const [openTabIds, setOpenTabIds] = useState(["f-index-js"]);
  const [activeFileId, setActiveFileId] = useState("f-index-js");
  const [dirtyFiles, setDirtyFiles] = useState({}); // { [fileId]: true }

  // Folder collapse state
  const [expandedFolders, setExpandedFolders] = useState({});

  // Inline creation / rename state
  const [newFileInput, setNewFileInput] = useState(null); // { parentPath, isFolder }
  const [newItemName, setNewItemName] = useState("");
  const [renamingId, setRenamingId] = useState(null);
  const [renameValue, setRenameValue] = useState("");

  // Editor settings
  const [settings, setSettings] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_SETTINGS);
      if (saved) return { ...DEFAULT_SETTINGS, ...JSON.parse(saved) };
    } catch {}
    return DEFAULT_SETTINGS;
  });

  // Code history snapshots (local to guest)
  const [codeRevisions, setCodeRevisions] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_HISTORY);
      if (saved) return JSON.parse(saved);
    } catch {}
    return [
      {
        id: "rev-init",
        fileId: "f-index-js",
        filename: "index.js",
        timestamp: Date.now() - 300000,
        content: DEFAULT_FILES[0].content,
      },
    ];
  });

  // Bottom Output Panel State
  const [bottomPanelTab, setBottomPanelTab] = useState("output"); // 'output' | 'input' | 'problems' | 'history'
  const [bottomPanelHeight, setBottomPanelHeight] = useState(220);
  const [isBottomCollapsed, setIsBottomCollapsed] = useState(false);
  const [stdinValue, setStdinValue] = useState("");

  // Execution state
  const [isExecuting, setIsExecuting] = useState(false);
  const [executionOutput, setExecutionOutput] = useState({
    stdout: "CoCode Compiler ready. Select a file and click 'Run Code' (or press Ctrl+Enter).",
    stderr: "",
    compileOutput: "",
    status: "Ready",
    time: null,
    memory: null,
  });

  const [execHistory, setExecHistory] = useState([]);
  const [copyOutputSuccess, setCopyOutputSuccess] = useState(false);

  // Search state
  const [searchQuery, setSearchQuery] = useState("");
  const [matchCase, setMatchCase] = useState(false);

  // AI Assistant state
  const [aiPrompt, setAiPrompt] = useState("");
  const [aiResponse, setAiResponse] = useState("");
  const [aiLoading, setAiLoading] = useState(false);

  // Analytics tracking (local to session)
  const [analytics, setAnalytics] = useState({
    sessionStart: Date.now(),
    executionsCount: 0,
    successCount: 0,
    failedCount: 0,
    recentEditedFiles: ["index.js"],
  });

  // Refs
  const editorRef = useRef(null);
  const monacoRef = useRef(null);
  const isResizingRef = useRef(false);
  const fileUploadInputRef = useRef(null);
  const folderUploadInputRef = useRef(null);
  const autosaveTimeoutRef = useRef(null);
  const snapshotTimeoutRef = useRef(null);

  // Current active file object
  const activeFile = useMemo(() => {
    return files.find((f) => f.id === activeFileId) || files.find((f) => !f.isFolder) || null;
  }, [files, activeFileId]);

  // Persist files to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY_FILES, JSON.stringify(files));
    } catch (e) {
      console.warn("Workspace persistence warning:", e);
    }
  }, [files]);

  // Persist settings
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY_SETTINGS, JSON.stringify(settings));
    } catch {}
  }, [settings]);

  // Persist history snapshots
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY_HISTORY, JSON.stringify(codeRevisions.slice(0, 50)));
    } catch {}
  }, [codeRevisions]);

  // Handle panel resizing
  const handleStartResizing = useCallback(() => {
    isResizingRef.current = true;
    const onMouseMove = (e) => {
      if (!isResizingRef.current) return;
      const newHeight = window.innerHeight - e.clientY;
      if (newHeight >= 80 && newHeight <= window.innerHeight - 120) {
        setBottomPanelHeight(newHeight);
        setIsBottomCollapsed(false);
      }
    };
    const onMouseUp = () => {
      isResizingRef.current = false;
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
    };
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
  }, []);

  // Define custom Monaco themes
  const handleEditorWillMount = (monaco) => {
    monacoRef.current = monaco;
    monaco.editor.defineTheme("cocode-dark", {
      base: "vs-dark",
      inherit: true,
      rules: [
        { token: "keyword", foreground: "f43f5e", fontStyle: "bold" },
        { token: "identifier", foreground: "58a6ff" },
        { token: "string", foreground: "a5d6ff" },
        { token: "comment", foreground: "6e7681", fontStyle: "italic" },
        { token: "number", foreground: "79c0ff" },
        { token: "delimiter", foreground: "e6edf3" },
        { token: "type", foreground: "d2a8ff" },
      ],
      colors: {
        "editor.background": "#0d1117",
        "editor.foreground": "#e6edf3",
        "editor.lineHighlightBackground": "#161b22",
        "editorLineNumber.foreground": "#484f58",
        "editorLineNumber.activeForeground": "#58a6ff",
        "editorCursor.foreground": "#58a6ff",
        "editor.selectionBackground": "#1e3a5f",
        "editor.inactiveSelectionBackground": "#152a45",
      },
    });
  };

  const handleEditorDidMount = (editor, monaco) => {
    editorRef.current = editor;

    // Add keyboard shortcuts
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter, () => {
      handleRunCode();
    });

    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () => {
      saveActiveFile();
    });

    editor.addCommand(monaco.KeyMod.Alt | monaco.KeyMod.Shift | monaco.KeyCode.KeyF, () => {
      formatCurrentDocument();
    });
  };

  // Format document action
  const formatCurrentDocument = () => {
    if (editorRef.current) {
      editorRef.current.getAction("editor.action.formatDocument")?.run();
    }
  };

  // Handle active file code changes
  const handleCodeChange = (newContent) => {
    if (!activeFile) return;
    const content = newContent || "";

    setFiles((prev) =>
      prev.map((f) => (f.id === activeFile.id ? { ...f, content } : f))
    );

    setDirtyFiles((prev) => ({ ...prev, [activeFile.id]: true }));

    // Update analytics recent edited
    setAnalytics((prev) => ({
      ...prev,
      recentEditedFiles: Array.from(new Set([activeFile.name, ...prev.recentEditedFiles])).slice(0, 8),
    }));

    // Autosave debouncing
    if (settings.autoSave) {
      if (autosaveTimeoutRef.current) clearTimeout(autosaveTimeoutRef.current);
      autosaveTimeoutRef.current = setTimeout(() => {
        setDirtyFiles((prev) => {
          const next = { ...prev };
          delete next[activeFile.id];
          return next;
        });
      }, 1000);
    }

    // Debounced snapshot history record
    if (snapshotTimeoutRef.current) clearTimeout(snapshotTimeoutRef.current);
    snapshotTimeoutRef.current = setTimeout(() => {
      takeCodeSnapshot(activeFile.id, activeFile.name, content);
    }, 4000);
  };

  // Record a local revision snapshot
  const takeCodeSnapshot = (fileId, filename, content) => {
    setCodeRevisions((prev) => {
      // Don't duplicate if identical to top revision
      if (prev.length > 0 && prev[0].fileId === fileId && prev[0].content === content) {
        return prev;
      }
      const newSnapshot = {
        id: `rev-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
        fileId,
        filename,
        timestamp: Date.now(),
        content,
      };
      return [newSnapshot, ...prev.slice(0, 49)];
    });
  };

  // Explicit Save
  const saveActiveFile = () => {
    if (!activeFile) return;
    setDirtyFiles((prev) => {
      const next = { ...prev };
      delete next[activeFile.id];
      return next;
    });
    takeCodeSnapshot(activeFile.id, activeFile.name, activeFile.content || "");
  };

  // Tab management
  const openFile = (file) => {
    if (file.isFolder) {
      toggleFolder(file.path);
      return;
    }
    if (!openTabIds.includes(file.id)) {
      setOpenTabIds((prev) => [...prev, file.id]);
    }
    setActiveFileId(file.id);
  };

  const closeTab = (e, tabId) => {
    e.stopPropagation();
    const remaining = openTabIds.filter((id) => id !== tabId);
    setOpenTabIds(remaining);
    if (activeFileId === tabId) {
      setActiveFileId(remaining[remaining.length - 1] || null);
    }
  };

  const toggleFolder = (path) => {
    setExpandedFolders((prev) => ({
      ...prev,
      [path]: !prev[path],
    }));
  };

  // Create Item (File or Folder)
  const handleCreateItem = () => {
    if (!newItemName.trim()) {
      setNewFileInput(null);
      return;
    }
    const cleanName = newItemName.trim();
    const parentPath = newFileInput?.parentPath || "";
    const path = `${parentPath}/${cleanName}`.replace(/\/+/g, "/");

    // Check duplicate
    if (files.some((f) => f.path === path)) {
      alert(`An item with path "${path}" already exists.`);
      return;
    }

    const isFolder = Boolean(newFileInput?.isFolder);
    const language = isFolder ? undefined : getLanguageFromFilename(cleanName);

    const newItem = {
      id: `f-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      name: cleanName,
      path,
      isFolder,
      language,
      content: isFolder ? undefined : "",
    };

    setFiles((prev) => [...prev, newItem]);

    if (!isFolder) {
      setOpenTabIds((prev) => [...prev, newItem.id]);
      setActiveFileId(newItem.id);
    } else {
      setExpandedFolders((prev) => ({ ...prev, [path]: true }));
    }

    setNewFileInput(null);
    setNewItemName("");
  };

  // Delete Item
  const handleDeleteItem = (item, e) => {
    e.stopPropagation();
    const isFolder = item.isFolder;
    const msg = isFolder
      ? `Are you sure you want to delete folder "${item.name}" and all its contents?`
      : `Delete file "${item.name}"?`;

    if (!window.confirm(msg)) return;

    setFiles((prev) =>
      prev.filter((f) => f.id !== item.id && !f.path.startsWith(`${item.path}/`))
    );
    setOpenTabIds((prev) => prev.filter((id) => id !== item.id));

    if (activeFileId === item.id) {
      setActiveFileId(null);
    }
  };

  // Rename Item
  const handleStartRename = (item, e) => {
    e.stopPropagation();
    setRenamingId(item.id);
    setRenameValue(item.name);
  };

  const submitRename = (item) => {
    const cleanNew = renameValue.trim();
    if (cleanNew && cleanNew !== item.name) {
      const parent = item.path.substring(0, item.path.lastIndexOf("/"));
      const newPath = `${parent}/${cleanNew}`.replace(/\/+/g, "/");

      setFiles((prev) =>
        prev.map((f) => {
          if (f.id === item.id) {
            return {
              ...f,
              name: cleanNew,
              path: newPath,
              language: f.isFolder ? undefined : getLanguageFromFilename(cleanNew),
            };
          }
          if (f.path.startsWith(`${item.path}/`)) {
            return { ...f, path: f.path.replace(item.path, newPath) };
          }
          return f;
        })
      );
    }
    setRenamingId(null);
  };

  // Upload Files handler
  const handleUploadFiles = (e) => {
    const uploaded = Array.from(e.target.files || []);
    if (!uploaded.length) return;

    uploaded.forEach((file) => {
      const reader = new FileReader();
      reader.onload = (event) => {
        const content = event.target.result;
        const language = getLanguageFromFilename(file.name);
        const newFile = {
          id: `f-up-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          name: file.name,
          path: `/${file.name}`,
          language,
          content,
          isFolder: false,
        };
        setFiles((prev) => {
          const filtered = prev.filter((x) => x.path !== newFile.path);
          return [...filtered, newFile];
        });
        setOpenTabIds((prev) => (prev.includes(newFile.id) ? prev : [...prev, newFile.id]));
        setActiveFileId(newFile.id);
      };
      reader.readAsText(file);
    });
    e.target.value = "";
  };

  // Upload Folder handler
  const handleUploadFolder = (e) => {
    const uploaded = Array.from(e.target.files || []);
    if (!uploaded.length) return;

    uploaded.forEach((file) => {
      const relativePath = file.webkitRelativePath || file.name;
      const normalizedPath = `/${relativePath}`.replace(/\/+/g, "/");
      const parts = normalizedPath.split("/").filter(Boolean);

      // Create intermediate folders
      let currentAcc = "";
      for (let i = 0; i < parts.length - 1; i++) {
        currentAcc += `/${parts[i]}`;
        const folderPath = currentAcc;
        const folderName = parts[i];
        setFiles((prev) => {
          if (prev.some((f) => f.path === folderPath)) return prev;
          return [
            ...prev,
            {
              id: `folder-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
              name: folderName,
              path: folderPath,
              isFolder: true,
            },
          ];
        });
      }

      // Read the file content
      const reader = new FileReader();
      reader.onload = (event) => {
        const content = event.target.result;
        const filename = parts[parts.length - 1];
        const language = getLanguageFromFilename(filename);

        const newFile = {
          id: `f-up-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          name: filename,
          path: normalizedPath,
          language,
          content,
          isFolder: false,
        };

        setFiles((prev) => {
          const filtered = prev.filter((x) => x.path !== newFile.path);
          return [...filtered, newFile];
        });
      };
      reader.readAsText(file);
    });
    e.target.value = "";
  };

  // Download Single Active File
  const handleDownloadActiveFile = () => {
    if (!activeFile) return;
    const blob = new Blob([activeFile.content || ""], { type: "text/plain;charset=utf-8" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = activeFile.name;
    link.click();
    URL.revokeObjectURL(link.href);
  };

  // Download entire workspace as ZIP
  const handleDownloadWorkspaceZip = async () => {
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
    link.download = "cocode-standalone-workspace.zip";
    link.click();
    URL.revokeObjectURL(link.href);
  };

  // Execute Code via backend Judge0 compiler API
  const handleRunCode = async () => {
    if (!activeFile) return;

    if (!isRunnableLanguage(activeFile.language)) {
      setBottomPanelTab("output");
      setIsBottomCollapsed(false);
      setExecutionOutput({
        stdout: "",
        stderr: `Notice: "${activeFile.name}" has language "${activeFile.language}".\n` +
          `Execution runtimes are available for JavaScript (.js), Python (.py), C (.c), C++ (.cpp), and Java (.java).\n` +
          `Please switch to an executable file or change the language selector to execute.`,
        compileOutput: "",
        status: "Notice",
        time: null,
        memory: null,
      });
      return;
    }

    if (isExecuting) return; // Prevent duplicate requests

    setIsExecuting(true);
    setBottomPanelTab("output");
    setIsBottomCollapsed(false);

    const startTime = Date.now();

    try {
      const response = await fetch(`${API_BASE}/api/compiler/run`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sourceCode: activeFile.content || "",
          language: activeFile.language,
          stdin: stdinValue,
        }),
      });

      const data = await response.json();
      const durationSeconds = ((Date.now() - startTime) / 1000).toFixed(3);

      if (!response.ok) {
        throw new Error(data.error || `Execution failed with HTTP ${response.status}`);
      }

      const isSuccess = data.status === "Finished" || (!data.stderr && !data.compileOutput);

      setExecutionOutput({
        stdout: data.stdout || "",
        stderr: data.stderr || "",
        compileOutput: data.compileOutput || "",
        status: data.status || "Finished",
        time: data.time ?? durationSeconds,
        memory: data.memory ?? null,
      });

      // Update analytics
      setAnalytics((prev) => ({
        ...prev,
        executionsCount: prev.executionsCount + 1,
        successCount: isSuccess ? prev.successCount + 1 : prev.successCount,
        failedCount: !isSuccess ? prev.failedCount + 1 : prev.failedCount,
      }));

      // Append to execution history
      setExecHistory((prev) => [
        {
          id: `exec-${Date.now()}`,
          timestamp: Date.now(),
          filename: activeFile.name,
          language: activeFile.language,
          status: isSuccess ? "Success" : "Failed",
          time: `${data.time ?? durationSeconds}s`,
          stdout: data.stdout || "",
          stderr: data.stderr || data.compileOutput || "",
        },
        ...prev.slice(0, 24),
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

      setAnalytics((prev) => ({
        ...prev,
        executionsCount: prev.executionsCount + 1,
        failedCount: prev.failedCount + 1,
      }));
    } finally {
      setIsExecuting(false);
    }
  };

  // Stop Execution
  const handleStopExecution = () => {
    setIsExecuting(false);
    setExecutionOutput((prev) => ({
      ...prev,
      stderr: (prev.stderr ? prev.stderr + "\n" : "") + "Execution halted by user.",
      status: "Stopped",
    }));
  };

  // Copy Output to Clipboard
  const handleCopyOutput = () => {
    const textToCopy =
      (executionOutput.stdout ? `=== STDOUT ===\n${executionOutput.stdout}\n` : "") +
      (executionOutput.stderr ? `=== STDERR ===\n${executionOutput.stderr}\n` : "") +
      (executionOutput.compileOutput ? `=== COMPILER OUTPUT ===\n${executionOutput.compileOutput}\n` : "");

    navigator.clipboard.writeText(textToCopy || "No output to copy");
    setCopyOutputSuccess(true);
    setTimeout(() => setCopyOutputSuccess(false), 2000);
  };

  // Clear Output
  const handleClearOutput = () => {
    setExecutionOutput({
      stdout: "",
      stderr: "",
      compileOutput: "",
      status: "Ready",
      time: null,
      memory: null,
    });
  };

  // AI Assistant action handler
  const handleAiAssist = async (actionType, customInstruction = "") => {
    if (!activeFile) return;
    setAiLoading(true);
    setActiveActivityTab("ai");

    const promptText =
      customInstruction ||
      aiPrompt ||
      `Analyze the following ${activeFile.language} code:\n\n${activeFile.content}`;

    try {
      const res = await fetch(`${API_BASE}/api/ai/assist`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: actionType,
          language: activeFile.language,
          code: activeFile.content || "",
          prompt: promptText,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "AI service request failed.");
      setAiResponse(data.reply || "Analysis completed.");
    } catch (err) {
      setAiResponse(
        `💡 AI Assistant (${actionType.toUpperCase()}):\n` +
        `• Language: ${activeFile.language.toUpperCase()}\n` +
        `• File: ${activeFile.name} (${(activeFile.content || "").split("\n").length} lines)\n\n` +
        `To enable live OpenAI/Gemini responses, set OPENAI_API_KEY or GEMINI_API_KEY in server/.env.\n\n` +
        `Quick Hint: Check syntax, input boundaries, and ensure all variables are initialized before running.`
      );
    } finally {
      setAiLoading(false);
    }
  };

  // Change Language of Active File
  const handleChangeActiveLanguage = (newLang) => {
    if (!activeFile) return;
    setFiles((prev) =>
      prev.map((f) => (f.id === activeFile.id ? { ...f, language: newLang } : f))
    );
  };

  // Global search filtering across workspace
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

  // Jump to search match in Monaco
  const handleJumpToSearchMatch = (match) => {
    openFile(match.file);
    setTimeout(() => {
      if (editorRef.current) {
        editorRef.current.revealLineInCenter(match.lineNumber);
        editorRef.current.setPosition({ lineNumber: match.lineNumber, column: 1 });
        editorRef.current.focus();
      }
    }, 50);
  };

  // Restore snapshot revision
  const handleRestoreRevision = (rev) => {
    if (!window.confirm(`Restore revision of "${rev.filename}" from ${new Date(rev.timestamp).toLocaleTimeString()}? Current unsaved edits will be replaced.`)) {
      return;
    }
    setFiles((prev) =>
      prev.map((f) => (f.id === rev.fileId ? { ...f, content: rev.content } : f))
    );
    if (!openTabIds.includes(rev.fileId)) {
      setOpenTabIds((prev) => [...prev, rev.fileId]);
    }
    setActiveFileId(rev.fileId);
  };

  // Reset to default files
  const handleResetWorkspace = () => {
    if (window.confirm("Reset entire compiler workspace back to default starter files?")) {
      setFiles(DEFAULT_FILES);
      setOpenTabIds(["f-index-js"]);
      setActiveFileId("f-index-js");
      setDirtyFiles({});
      localStorage.removeItem(STORAGE_KEY_FILES);
    }
  };

  // Language badge renderer
  const renderLanguageBadge = (lang) => {
    const l = (lang || "").toLowerCase();
    if (l === "javascript" || l === "js") return <span className="cc-lang-badge badge-js">JS</span>;
    if (l === "python" || l === "py") return <span className="cc-lang-badge badge-py">PY</span>;
    if (l === "cpp" || l === "c++") return <span className="cc-lang-badge badge-cpp">C++</span>;
    if (l === "c") return <span className="cc-lang-badge badge-c">C</span>;
    if (l === "java") return <span className="cc-lang-badge badge-java">JAVA</span>;
    if (l === "html") return <span className="cc-lang-badge badge-html">HTML</span>;
    if (l === "css") return <span className="cc-lang-badge badge-css">CSS</span>;
    if (l === "json") return <span className="cc-lang-badge badge-json">JSON</span>;
    if (l === "markdown" || l === "md") return <span className="cc-lang-badge badge-md">MD</span>;
    return <span className="cc-lang-badge badge-file">TXT</span>;
  };

  // Parse problems diagnostics from stderr or compile output
  const problemsList = useMemo(() => {
    const raw = (executionOutput.compileOutput || "") + "\n" + (executionOutput.stderr || "");
    if (!raw.trim()) return [];

    const lines = raw.split("\n");
    const problems = [];

    lines.forEach((l, idx) => {
      const line = l.trim();
      if (!line) return;
      if (
        line.toLowerCase().includes("error") ||
        line.toLowerCase().includes("fatal") ||
        line.toLowerCase().includes("exception") ||
        line.toLowerCase().includes("traceback") ||
        line.toLowerCase().includes("syntaxerror") ||
        line.toLowerCase().includes("warning")
      ) {
        problems.push({
          id: `prob-${idx}`,
          type: line.toLowerCase().includes("warning") ? "warning" : "error",
          text: line,
        });
      }
    });

    return problems.slice(0, 20);
  }, [executionOutput]);

  return (
    <div className="cc-compiler-root">
      {/* Hidden file inputs for Upload */}
      <input
        type="file"
        ref={fileUploadInputRef}
        onChange={handleUploadFiles}
        multiple
        style={{ display: "none" }}
      />
      <input
        type="file"
        ref={folderUploadInputRef}
        onChange={handleUploadFolder}
        webkitdirectory=""
        directory=""
        multiple
        style={{ display: "none" }}
      />

      {/* ======================================================================
          Top Application Toolbar
      ====================================================================== */}
      <header className="cc-topbar">
        <div className="cc-topbar-left">
          <Link to="/" className="cc-brand" title="CoCode Home">
            <span className="cc-brand-badge">C</span>
            <span>CoCode</span>
          </Link>

          {activeFile && (
            <div className="cc-file-breadcrumb" title={`Active file: ${activeFile.path}`}>
              {renderLanguageBadge(activeFile.language)}
              <strong>{activeFile.name}</strong>
              <span className="cc-breadcrumb-sep">/</span>
              <span>Standalone Workspace</span>
            </div>
          )}
        </div>

        <div className="cc-topbar-center">
          {activeFile && (
            <select
              className="cc-lang-select"
              value={activeFile.language || "javascript"}
              onChange={(e) => handleChangeActiveLanguage(e.target.value)}
              title="Select Language Syntax Mode"
            >
              <option value="javascript">JavaScript (Node 22)</option>
              <option value="python">Python (3.12)</option>
              <option value="cpp">C++ (GCC 14.1)</option>
              <option value="c">C (GCC 14.1)</option>
              <option value="java">Java (OpenJDK 17)</option>
              <option value="html">HTML5</option>
              <option value="css">CSS3</option>
              <option value="json">JSON</option>
              <option value="markdown">Markdown</option>
              <option value="plaintext">Plain Text</option>
            </select>
          )}

          <div
            className={`cc-save-indicator ${activeFile && dirtyFiles[activeFile.id] ? "unsaved" : "saved"}`}
            title={activeFile && dirtyFiles[activeFile.id] ? "Unsaved changes (Ctrl+S to save)" : "All changes saved locally"}
          >
            <span className="cc-dot" />
            <span>{activeFile && dirtyFiles[activeFile.id] ? "Unsaved" : "Saved"}</span>
          </div>
        </div>

        <div className="cc-topbar-right">
          {isExecuting ? (
            <button className="cc-btn-stop" onClick={handleStopExecution} title="Stop Code Execution">
              <Square size={13} fill="currentColor" />
              <span>Stop</span>
            </button>
          ) : (
            <button
              className="cc-btn-run"
              onClick={handleRunCode}
              title="Execute active code (Ctrl+Enter)"
              disabled={isExecuting}
            >
              <Play size={13} fill="currentColor" />
              <span>Run Code</span>
            </button>
          )}

          <button
            className="cc-btn-ghost"
            onClick={saveActiveFile}
            title="Save file (Ctrl+S)"
          >
            <span>Save</span>
          </button>

          <button
            className="cc-btn-ghost"
            onClick={handleDownloadWorkspaceZip}
            title="Download complete workspace as ZIP"
          >
            <Download size={13} />
            <span>Export ZIP</span>
          </button>
        </div>
      </header>

      {/* ======================================================================
          Body: Activity Bar + Left Sidebar Panel + Monaco Editor Surface
      ====================================================================== */}
      <div className="cc-body">
        {/* Left Activity Bar (No Chat, No Rooms, No Teams) */}
        <aside className="cc-activity-bar" aria-label="Activity Bar">
          <div className="cc-activity-group">
            <button
              className={`cc-activity-btn ${activeActivityTab === "files" ? "active" : ""}`}
              onClick={() => setActiveActivityTab(activeActivityTab === "files" ? null : "files")}
              title="Explorer: Files & Folders (Ctrl+Shift+E)"
            >
              <Files size={20} />
            </button>
            <button
              className={`cc-activity-btn ${activeActivityTab === "search" ? "active" : ""}`}
              onClick={() => setActiveActivityTab(activeActivityTab === "search" ? null : "search")}
              title="Global Search across Workspace (Ctrl+Shift+F)"
            >
              <Search size={20} />
            </button>
            <button
              className={`cc-activity-btn ${activeActivityTab === "history" ? "active" : ""}`}
              onClick={() => setActiveActivityTab(activeActivityTab === "history" ? null : "history")}
              title="Code History: Local Revisions & Snapshots"
            >
              <History size={20} />
            </button>
            <button
              className={`cc-activity-btn ${activeActivityTab === "run" ? "active" : ""}`}
              onClick={() => {
                setActiveActivityTab("run");
                handleRunCode();
              }}
              title="Run & Output Panel"
            >
              <Play size={20} />
            </button>
            <button
              className={`cc-activity-btn ${activeActivityTab === "ai" ? "active" : ""}`}
              onClick={() => setActiveActivityTab(activeActivityTab === "ai" ? null : "ai")}
              title="AI Coding Assistant"
            >
              <Sparkles size={20} />
            </button>
            <button
              className={`cc-activity-btn ${activeActivityTab === "analytics" ? "active" : ""}`}
              onClick={() => setActiveActivityTab(activeActivityTab === "analytics" ? null : "analytics")}
              title="Activity Analytics: Local Session Stats"
            >
              <TrendingUp size={20} />
            </button>
          </div>

          <div className="cc-activity-group">
            <button
              className={`cc-activity-btn ${activeActivityTab === "devtools" ? "active" : ""}`}
              onClick={() => setActiveActivityTab(activeActivityTab === "devtools" ? null : "devtools")}
              title="Developer Tools & Shortcuts"
            >
              <Wrench size={20} />
            </button>
            <button
              className={`cc-activity-btn ${activeActivityTab === "settings" ? "active" : ""}`}
              onClick={() => setActiveActivityTab(activeActivityTab === "settings" ? null : "settings")}
              title="IDE Settings"
            >
              <SettingsIcon size={20} />
            </button>
          </div>
        </aside>

        {/* Sidebar Panel Content */}
        {activeActivityTab && (
          <aside className="cc-sidebar">
            {/* 1. Files / Explorer */}
            {activeActivityTab === "files" && (
              <>
                <div className="cc-sidebar-header">
                  <span className="cc-sidebar-title">Explorer</span>
                  <div className="cc-sidebar-actions">
                    <button
                      className="cc-icon-btn"
                      onClick={() => setNewFileInput({ parentPath: "", isFolder: false })}
                      title="New File"
                    >
                      <FilePlus size={15} />
                    </button>
                    <button
                      className="cc-icon-btn"
                      onClick={() => setNewFileInput({ parentPath: "", isFolder: true })}
                      title="New Folder"
                    >
                      <FolderPlus size={15} />
                    </button>
                    <button
                      className="cc-icon-btn"
                      onClick={() => fileUploadInputRef.current?.click()}
                      title="Upload Files"
                    >
                      <Upload size={15} />
                    </button>
                  </div>
                </div>

                <div className="cc-sidebar-content">
                  {/* Inline creation input at root */}
                  {newFileInput && newFileInput.parentPath === "" && (
                    <div style={{ padding: "4px 8px" }}>
                      <input
                        type="text"
                        autoFocus
                        className="cc-tree-inline-input"
                        placeholder={newFileInput.isFolder ? "folder name..." : "filename.js..."}
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

                  {/* File tree items */}
                  {files.map((item) => {
                    const isRenaming = renamingId === item.id;
                    const isActive = activeFileId === item.id;

                    return (
                      <div
                        key={item.id}
                        className={`cc-tree-item ${item.isFolder ? "cc-tree-folder" : ""} ${isActive ? "active" : ""}`}
                        onClick={() => openFile(item)}
                      >
                        {item.isFolder ? (
                          <ChevronRight
                            size={14}
                            style={{
                              transform: expandedFolders[item.path] ? "rotate(90deg)" : "none",
                              transition: "transform 0.1s",
                              color: "#8b949e",
                            }}
                          />
                        ) : (
                          renderLanguageBadge(item.language)
                        )}

                        {isRenaming ? (
                          <input
                            type="text"
                            autoFocus
                            className="cc-tree-inline-input"
                            value={renameValue}
                            onChange={(e) => setRenameValue(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") submitRename(item);
                              if (e.key === "Escape") setRenamingId(null);
                            }}
                            onBlur={() => submitRename(item)}
                            onClick={(e) => e.stopPropagation()}
                          />
                        ) : (
                          <span className="cc-tree-name">{item.name}</span>
                        )}

                        <div className="cc-tree-hover-actions">
                          <button
                            className="cc-tree-action-btn"
                            onClick={(e) => handleStartRename(item, e)}
                            title="Rename"
                          >
                            <Edit2 size={12} />
                          </button>
                          <button
                            className="cc-tree-action-btn danger"
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

                {/* Bottom Explorer Action Pills */}
                <div className="cc-sidebar-bottom">
                  <button
                    className="cc-bottom-pill"
                    onClick={() => fileUploadInputRef.current?.click()}
                  >
                    <Upload size={14} />
                    <span>Upload Files</span>
                  </button>
                  <button
                    className="cc-bottom-pill"
                    onClick={() => folderUploadInputRef.current?.click()}
                  >
                    <FolderUp size={14} />
                    <span>Upload Folder</span>
                  </button>
                  <button
                    className="cc-bottom-pill"
                    onClick={handleDownloadActiveFile}
                  >
                    <Download size={14} />
                    <span>Download Code</span>
                  </button>
                </div>
              </>
            )}

            {/* 2. Search */}
            {activeActivityTab === "search" && (
              <div className="cc-panel-view">
                <span className="cc-panel-section-title">Workspace Search</span>
                <input
                  type="text"
                  className="cc-search-input"
                  placeholder="Search code across all files..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  autoFocus
                />
                <div style={{ display: "flex", alignItems: "center", gap: 6, margin: "4px 0 8px" }}>
                  <label style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11, color: "#8b949e", cursor: "pointer" }}>
                    <input
                      type="checkbox"
                      checked={matchCase}
                      onChange={(e) => setMatchCase(e.target.checked)}
                    />
                    <span>Match Case</span>
                  </label>
                  <span style={{ marginLeft: "auto", fontSize: 10, color: "#6e7681" }}>
                    {searchResults.length} match{searchResults.length === 1 ? "" : "es"}
                  </span>
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                  {searchResults.map((match, idx) => (
                    <div
                      key={idx}
                      className="cc-search-result"
                      onClick={() => handleJumpToSearchMatch(match)}
                    >
                      <div className="cc-search-result-file">{match.file.name}</div>
                      <div className="cc-search-result-line">Line {match.lineNumber}</div>
                      <div className="cc-search-result-snippet">{match.lineText}</div>
                    </div>
                  ))}
                  {searchQuery.trim() && searchResults.length === 0 && (
                    <div className="cc-empty-state">
                      <div className="cc-empty-state-title">No matching text found</div>
                      <div className="cc-empty-state-desc">Try searching for a different keyword or function name.</div>
                    </div>
                  )}
                  {!searchQuery.trim() && (
                    <div className="cc-empty-state">
                      <div className="cc-empty-state-title">Global Project Search</div>
                      <div className="cc-empty-state-desc">Type keywords or symbols above to scan your current workspace files.</div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* 3. Code History */}
            {activeActivityTab === "history" && (
              <div className="cc-panel-view">
                <span className="cc-panel-section-title">Local Code Snapshots</span>
                <p style={{ fontSize: 11, color: "#8b949e", margin: "0 0 10px" }}>
                  Automatic checkpoints recorded during this session. No git account required.
                </p>

                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {codeRevisions.map((rev) => (
                    <div key={rev.id} className="cc-history-card">
                      <div className="cc-history-meta">
                        <span className="cc-history-filename">{rev.filename}</span>
                        <span>{new Date(rev.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}</span>
                      </div>
                      <div className="cc-history-preview">
                        {(rev.content || "").slice(0, 100).replace(/\n/g, " ") || "(Empty file)"}
                      </div>
                      <button
                        className="cc-btn-sm"
                        onClick={() => handleRestoreRevision(rev)}
                      >
                        <RotateCcw size={11} />
                        <span>Restore Snapshot</span>
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 4. Run / Output Quick View */}
            {activeActivityTab === "run" && (
              <div className="cc-panel-view">
                <span className="cc-panel-section-title">Compiler Engine</span>
                <p style={{ fontSize: 11, color: "#8b949e" }}>
                  Selected file: <strong>{activeFile?.name || "None"}</strong>
                </p>
                <button
                  className="cc-btn-run"
                  style={{ width: "100%", justifyContent: "center", margin: "8px 0" }}
                  onClick={handleRunCode}
                  disabled={isExecuting}
                >
                  <Play size={14} fill="currentColor" />
                  <span>{isExecuting ? "Executing..." : "Execute Code"}</span>
                </button>
                <div className="cc-settings-row">
                  <span className="cc-settings-label">Target Runtime</span>
                  <div style={{ fontSize: 12, color: "#58a6ff", fontWeight: 600 }}>
                    {activeFile ? `${activeFile.language.toUpperCase()} (Judge0 CE Isolated Sandbox)` : "None"}
                  </div>
                </div>
              </div>
            )}

            {/* 5. AI Assistant */}
            {activeActivityTab === "ai" && (
              <div className="cc-panel-view">
                <span className="cc-panel-section-title">CoCode AI Assistant</span>
                <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 10 }}>
                  <button
                    className="cc-ai-quick-action"
                    onClick={() => handleAiAssist("explain")}
                    disabled={aiLoading}
                  >
                    <Sparkles size={14} />
                    <span>Explain Active File</span>
                  </button>
                  <button
                    className="cc-ai-quick-action"
                    onClick={() => handleAiAssist("fix")}
                    disabled={aiLoading}
                  >
                    <AlertTriangle size={14} />
                    <span>Find & Suggest Bug Fixes</span>
                  </button>
                  <button
                    className="cc-ai-quick-action"
                    onClick={() => handleAiAssist("refactor")}
                    disabled={aiLoading}
                  >
                    <Code2 size={14} />
                    <span>Refactor & Optimize Code</span>
                  </button>
                </div>

                <textarea
                  className="cc-ai-textarea"
                  placeholder="Ask a question about this code or paste instructions..."
                  value={aiPrompt}
                  onChange={(e) => setAiPrompt(e.target.value)}
                />
                <button
                  className="cc-btn-ghost"
                  style={{ justifyContent: "center", margin: "6px 0 10px" }}
                  onClick={() => handleAiAssist("custom")}
                  disabled={aiLoading}
                >
                  {aiLoading ? <span className="cc-spinner">●</span> : <Sparkles size={13} />}
                  <span>{aiLoading ? "Analyzing..." : "Ask Assistant"}</span>
                </button>

                {aiResponse && (
                  <div className="cc-ai-response">
                    {aiResponse}
                  </div>
                )}
              </div>
            )}

            {/* 6. Activity Analytics */}
            {activeActivityTab === "analytics" && (
              <div className="cc-panel-view">
                <span className="cc-panel-section-title">Session Analytics</span>
                <div className="cc-stat-grid">
                  <div className="cc-stat-card">
                    <div className="cc-stat-label">Executions</div>
                    <div className="cc-stat-value">{analytics.executionsCount}</div>
                  </div>
                  <div className="cc-stat-card">
                    <div className="cc-stat-label">Successful</div>
                    <div className="cc-stat-value" style={{ color: "#3fb950" }}>
                      {analytics.successCount}
                    </div>
                  </div>
                  <div className="cc-stat-card">
                    <div className="cc-stat-label">Failed/Errors</div>
                    <div className="cc-stat-value" style={{ color: "#f85149" }}>
                      {analytics.failedCount}
                    </div>
                  </div>
                  <div className="cc-stat-card">
                    <div className="cc-stat-label">Total Files</div>
                    <div className="cc-stat-value">{files.filter((f) => !f.isFolder).length}</div>
                  </div>
                </div>

                <div style={{ marginTop: 14 }}>
                  <span className="cc-settings-label">Recently Edited Files</span>
                  <div style={{ marginTop: 6, display: "flex", flexDirection: "column", gap: 4 }}>
                    {analytics.recentEditedFiles.map((fn, idx) => (
                      <div key={idx} style={{ fontSize: 11, color: "#c9d1d9", display: "flex", alignItems: "center", gap: 6 }}>
                        <span style={{ color: "#58a6ff" }}>•</span>
                        <span>{fn}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* 7. Developer Tools */}
            {activeActivityTab === "devtools" && (
              <div className="cc-panel-view">
                <span className="cc-panel-section-title">Developer Utilities</span>
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  <button className="cc-ai-quick-action" onClick={formatCurrentDocument}>
                    <Code2 size={14} />
                    <span>Format Document (Alt+Shift+F)</span>
                  </button>
                  <button className="cc-ai-quick-action" onClick={handleClearOutput}>
                    <Terminal size={14} />
                    <span>Clear Terminal Output</span>
                  </button>
                  <button className="cc-ai-quick-action" onClick={handleResetWorkspace}>
                    <RotateCcw size={14} />
                    <span>Reset Workspace to Starter Code</span>
                  </button>
                </div>

                <div style={{ marginTop: 14 }}>
                  <span className="cc-settings-label">Keyboard Shortcuts</span>
                  <div style={{ marginTop: 8, fontSize: 11, color: "#8b949e", display: "flex", flexDirection: "column", gap: 5 }}>
                    <div><strong style={{ color: "#e6edf3" }}>Ctrl + Enter:</strong> Run Code</div>
                    <div><strong style={{ color: "#e6edf3" }}>Ctrl + S:</strong> Save File Snapshot</div>
                    <div><strong style={{ color: "#e6edf3" }}>Alt + Shift + F:</strong> Format Document</div>
                    <div><strong style={{ color: "#e6edf3" }}>Ctrl + F:</strong> Find in Code</div>
                  </div>
                </div>
              </div>
            )}

            {/* 8. Settings */}
            {activeActivityTab === "settings" && (
              <div className="cc-panel-view">
                <span className="cc-panel-section-title">Editor Preferences</span>

                <div className="cc-settings-row">
                  <label className="cc-settings-label">Font Size ({settings.fontSize}px)</label>
                  <select
                    className="cc-settings-control"
                    value={settings.fontSize}
                    onChange={(e) => setSettings((s) => ({ ...s, fontSize: Number(e.target.value) }))}
                  >
                    <option value={12}>12px</option>
                    <option value={13}>13px</option>
                    <option value={14}>14px (Default)</option>
                    <option value={16}>16px</option>
                    <option value={18}>18px</option>
                    <option value={20}>20px</option>
                  </select>
                </div>

                <div className="cc-settings-row">
                  <label className="cc-settings-label">Tab Size</label>
                  <select
                    className="cc-settings-control"
                    value={settings.tabSize}
                    onChange={(e) => setSettings((s) => ({ ...s, tabSize: Number(e.target.value) }))}
                  >
                    <option value={2}>2 Spaces</option>
                    <option value={4}>4 Spaces (Default)</option>
                    <option value={8}>8 Spaces</option>
                  </select>
                </div>

                <div className="cc-settings-row">
                  <label className="cc-settings-label">Word Wrap</label>
                  <select
                    className="cc-settings-control"
                    value={settings.wordWrap}
                    onChange={(e) => setSettings((s) => ({ ...s, wordWrap: e.target.value }))}
                  >
                    <option value="on">On</option>
                    <option value="off">Off</option>
                  </select>
                </div>

                <div className="cc-settings-row">
                  <label className="cc-settings-label">Minimap</label>
                  <select
                    className="cc-settings-control"
                    value={settings.minimap ? "true" : "false"}
                    onChange={(e) => setSettings((s) => ({ ...s, minimap: e.target.value === "true" }))}
                  >
                    <option value="true">Visible</option>
                    <option value="false">Hidden</option>
                  </select>
                </div>

                <div className="cc-settings-row">
                  <label className="cc-settings-label">Line Numbers</label>
                  <select
                    className="cc-settings-control"
                    value={settings.lineNumbers}
                    onChange={(e) => setSettings((s) => ({ ...s, lineNumbers: e.target.value }))}
                  >
                    <option value="on">On</option>
                    <option value="off">Off</option>
                  </select>
                </div>

                <div className="cc-settings-row">
                  <label className="cc-settings-label">Autosave</label>
                  <select
                    className="cc-settings-control"
                    value={settings.autoSave ? "true" : "false"}
                    onChange={(e) => setSettings((s) => ({ ...s, autoSave: e.target.value === "true" }))}
                  >
                    <option value="true">Enabled</option>
                    <option value="false">Disabled</option>
                  </select>
                </div>

                <button
                  className="cc-btn-ghost"
                  style={{ marginTop: 12, justifyContent: "center" }}
                  onClick={() => setSettings(DEFAULT_SETTINGS)}
                >
                  <RotateCcw size={13} />
                  <span>Reset to Defaults</span>
                </button>
              </div>
            )}
          </aside>
        )}

        {/* ====================================================================
            Main Surface (Tabs + Monaco Editor + Resizable Bottom Panel)
        ==================================================================== */}
        <main className="cc-main">
          {/* Tabs Bar */}
          <div className="cc-tabs-bar">
            {openTabIds.map((tabId) => {
              const file = files.find((f) => f.id === tabId);
              if (!file) return null;
              const isActive = activeFileId === tabId;
              const isDirty = dirtyFiles[tabId];

              return (
                <div
                  key={tabId}
                  className={`cc-tab ${isActive ? "active" : ""}`}
                  onClick={() => setActiveFileId(tabId)}
                >
                  {renderLanguageBadge(file.language)}
                  <span className="cc-tab-label">{file.name}</span>
                  {isDirty && <span className="cc-tab-dirty" title="Unsaved changes" />}
                  <button
                    className="cc-tab-close"
                    onClick={(e) => closeTab(e, tabId)}
                    title="Close tab"
                  >
                    <X size={12} />
                  </button>
                </div>
              );
            })}

            <button
              className="cc-tabs-add-btn"
              onClick={() => {
                setActiveActivityTab("files");
                setNewFileInput({ parentPath: "", isFolder: false });
              }}
              title="Add New File"
            >
              <FilePlus size={14} />
            </button>
          </div>

          {/* Monaco Editor Workspace */}
          <div className="cc-editor-workspace">
            {activeFile ? (
              <Editor
                height="100%"
                language={activeFile.language || "javascript"}
                value={activeFile.content || ""}
                theme={settings.theme}
                beforeMount={handleEditorWillMount}
                onMount={handleEditorDidMount}
                onChange={handleCodeChange}
                options={{
                  fontSize: settings.fontSize,
                  tabSize: settings.tabSize,
                  wordWrap: settings.wordWrap,
                  minimap: { enabled: settings.minimap },
                  lineNumbers: settings.lineNumbers,
                  scrollBeyondLastLine: false,
                  automaticLayout: true,
                  fontFamily: "'JetBrains Mono', Consolas, 'Courier New', monospace",
                  fontLigatures: true,
                  bracketPairColorization: { enabled: true },
                  smoothScrolling: true,
                  cursorBlinking: "smooth",
                  cursorSmoothCaretAnimation: "on",
                  renderWhitespace: "selection",
                  folding: true,
                  suggestOnTriggerCharacters: true,
                  acceptSuggestionOnEnter: "on",
                }}
              />
            ) : (
              <div className="cc-empty-state">
                <div className="cc-empty-state-icon">📄</div>
                <div className="cc-empty-state-title">No file open</div>
                <div className="cc-empty-state-desc">
                  Select a file from the explorer on the left or click the "+" button to create a new file.
                </div>
              </div>
            )}

            {/* Floating breadcrumb tag */}
            {activeFile && (
              <div className="cc-floating-pill">
                <span>{activeFile.name}</span>
                <span>•</span>
                <span>{activeFile.language.toUpperCase()}</span>
                {dirtyFiles[activeFile.id] && <span>• (Unsaved)</span>}
              </div>
            )}
          </div>

          {/* ==================================================================
              Bottom Resizable Output Panel
          ================================================================== */}
          <div
            className="cc-bottom-panel"
            style={{ height: isBottomCollapsed ? 34 : bottomPanelHeight }}
          >
            {/* Drag Resizer Handle */}
            <div
              className="cc-panel-resizer"
              onMouseDown={handleStartResizing}
              title="Drag to resize panel"
            />

            {/* Header Tabs */}
            <div className="cc-panel-header">
              <div className="cc-panel-tabs">
                <button
                  className={`cc-panel-tab-btn ${bottomPanelTab === "output" ? "active" : ""}`}
                  onClick={() => {
                    setBottomPanelTab("output");
                    setIsBottomCollapsed(false);
                  }}
                >
                  <Terminal size={13} />
                  <span>Output</span>
                </button>
                <button
                  className={`cc-panel-tab-btn ${bottomPanelTab === "input" ? "active" : ""}`}
                  onClick={() => {
                    setBottomPanelTab("input");
                    setIsBottomCollapsed(false);
                  }}
                >
                  <Code2 size={13} />
                  <span>Input (stdin)</span>
                </button>
                <button
                  className={`cc-panel-tab-btn ${bottomPanelTab === "problems" ? "active" : ""}`}
                  onClick={() => {
                    setBottomPanelTab("problems");
                    setIsBottomCollapsed(false);
                  }}
                >
                  <AlertCircle size={13} />
                  <span>Problems {problemsList.length > 0 && `(${problemsList.length})`}</span>
                </button>
                <button
                  className={`cc-panel-tab-btn ${bottomPanelTab === "history" ? "active" : ""}`}
                  onClick={() => {
                    setBottomPanelTab("history");
                    setIsBottomCollapsed(false);
                  }}
                >
                  <Clock size={13} />
                  <span>Run History {execHistory.length > 0 && `(${execHistory.length})`}</span>
                </button>
              </div>

              <div className="cc-panel-header-actions">
                {bottomPanelTab === "output" && (
                  <>
                    <button
                      className="cc-icon-btn"
                      onClick={handleCopyOutput}
                      title="Copy Output"
                    >
                      {copyOutputSuccess ? <Check size={14} style={{ color: "#3fb950" }} /> : <Copy size={14} />}
                    </button>
                    <button
                      className="cc-icon-btn"
                      onClick={handleClearOutput}
                      title="Clear Output"
                    >
                      <RotateCcw size={14} />
                    </button>
                  </>
                )}

                <button
                  className="cc-icon-btn"
                  onClick={() => setIsBottomCollapsed(!isBottomCollapsed)}
                  title={isBottomCollapsed ? "Expand Panel" : "Collapse Panel"}
                >
                  {isBottomCollapsed ? <Maximize2 size={13} /> : <Minimize2 size={13} />}
                </button>
              </div>
            </div>

            {/* Panel Body */}
            {!isBottomCollapsed && (
              <div className="cc-panel-body">
                {/* 1. Output View */}
                {bottomPanelTab === "output" && (
                  <div>
                    {isExecuting ? (
                      <div style={{ display: "flex", alignItems: "center", gap: 8, color: "#38bdf8" }}>
                        <span className="cc-spinner">●</span>
                        <span>Compiling and executing in isolated container...</span>
                      </div>
                    ) : (
                      <>
                        {executionOutput.stdout && (
                          <div className="cc-output-stdout">{executionOutput.stdout}</div>
                        )}
                        {executionOutput.compileOutput && (
                          <div className="cc-output-compile">{executionOutput.compileOutput}</div>
                        )}
                        {executionOutput.stderr && (
                          <div className="cc-output-stderr">{executionOutput.stderr}</div>
                        )}
                        {!executionOutput.stdout && !executionOutput.stderr && !executionOutput.compileOutput && (
                          <div className="cc-output-hint">
                            Output will appear here after clicking "Run Code" (Ctrl+Enter).
                          </div>
                        )}

                        {/* Execution metadata stats */}
                        {executionOutput.status && (
                          <div className="cc-output-meta">
                            <div>
                              Status:{" "}
                              <span
                                className={
                                  executionOutput.status === "Finished" || executionOutput.status === "Success"
                                    ? "cc-output-status-ok"
                                    : "cc-output-status-err"
                                }
                              >
                                {executionOutput.status}
                              </span>
                            </div>
                            {executionOutput.time !== null && (
                              <div>Time: {executionOutput.time}s</div>
                            )}
                            {executionOutput.memory !== null && (
                              <div>Memory: {(executionOutput.memory / 1024).toFixed(1)} MB</div>
                            )}
                          </div>
                        )}
                      </>
                    )}
                  </div>
                )}

                {/* 2. Stdin View */}
                {bottomPanelTab === "input" && (
                  <textarea
                    className="cc-stdin-area"
                    placeholder="Enter standard input (stdin) lines here to pass to your program during execution..."
                    value={stdinValue}
                    onChange={(e) => setStdinValue(e.target.value)}
                  />
                )}

                {/* 3. Problems View */}
                {bottomPanelTab === "problems" && (
                  <div>
                    {problemsList.length === 0 ? (
                      <div style={{ color: "#8b949e", fontSize: 12 }}>
                        No compiler or syntax errors detected in the last execution.
                      </div>
                    ) : (
                      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                        {problemsList.map((prob) => (
                          <div
                            key={prob.id}
                            style={{
                              display: "flex",
                              alignItems: "flex-start",
                              gap: 8,
                              color: prob.type === "warning" ? "#e3b341" : "#f85149",
                              fontSize: 12,
                            }}
                          >
                            <AlertCircle size={14} style={{ flexShrink: 0, marginTop: 2 }} />
                            <span>{prob.text}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* 4. Execution History View */}
                {bottomPanelTab === "history" && (
                  <div>
                    {execHistory.length === 0 ? (
                      <div style={{ color: "#8b949e", fontSize: 12 }}>
                        No past executions recorded in this browser session. Click "Run Code" to compile.
                      </div>
                    ) : (
                      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                        {execHistory.map((item) => (
                          <div key={item.id} className="cc-exec-row">
                            <span style={{ fontWeight: 600, color: "#e6edf3" }}>{item.filename}</span>
                            <span style={{ color: "#8b949e" }}>{item.language}</span>
                            <span
                              style={{
                                color: item.status === "Success" ? "#3fb950" : "#f85149",
                                fontWeight: 600,
                              }}
                            >
                              {item.status}
                            </span>
                            <span style={{ color: "#6e7681" }}>{item.time}</span>
                            <span style={{ color: "#6e7681" }}>
                              {new Date(item.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
