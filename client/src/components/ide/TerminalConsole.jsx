import React, { useState, useRef, useEffect } from "react";
import { Terminal, Trash2, Play, ShieldCheck, CornerDownLeft } from "lucide-react";

const INITIAL_WELCOME = [
  "CoCode Integrated Developer Terminal [Version 2.0.0]",
  "Type 'help' to view available commands. Type 'run' to execute current file.",
  "Security: Sandboxed environment enabled. No direct host access.",
  "",
];

export default function TerminalConsole({
  activeFile,
  files = [],
  projectName = "Default Workspace",
  userName = "developer",
  onRunCode,
  isExecuting = false,
}) {
  const [lines, setLines] = useState(INITIAL_WELCOME);
  const [inputVal, setInputVal] = useState("");
  const [history, setHistory] = useState([]);
  const [historyIdx, setHistoryIdx] = useState(-1);

  const terminalEndRef = useRef(null);
  const inputRef = useRef(null);

  // Auto-scroll to bottom on output change
  useEffect(() => {
    terminalEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [lines]);

  function handleCommand(cmdRaw) {
    const cmd = cmdRaw.trim();
    if (!cmd) return;

    // Add to history
    setHistory((prev) => [...prev, cmd]);
    setHistoryIdx(-1);

    const promptLine = `cocode@ide:~$ ${cmd}`;
    const newOutput = [...lines, promptLine];

    const parts = cmd.split(" ");
    const command = parts[0].toLowerCase();
    const args = parts.slice(1);

    switch (command) {
      case "help":
        newOutput.push(
          "Available Commands:",
          "  run            - Execute the currently open file in Judge0 runner",
          "  ls / dir       - List all files and directories in current project",
          "  cat <file>     - Display content of a project file",
          "  status         - Display workspace, active file, and runner health",
          "  clear / cls    - Clear terminal screen",
          "  echo <text>    - Print text to terminal",
          "  date           - Display current UTC timestamp",
          "  whoami         - Print active authenticated developer identity",
          "  node / python  - Run active script via respective compiler runtime",
          "  help           - Show this help menu",
          ""
        );
        break;

      case "clear":
      case "cls":
        setLines([]);
        setInputVal("");
        return;

      case "run":
      case "node":
      case "python":
        if (!activeFile) {
          newOutput.push("Error: No active file selected to run.");
        } else {
          newOutput.push(`Executing ${activeFile.name} (${activeFile.language})...`);
          if (onRunCode) {
            onRunCode();
          }
        }
        break;

      case "ls":
      case "dir": {
        const fileList = files
          .filter((f) => f.name !== ".cocode-keep")
          .map((f) => (f.isFolder ? `📁 ${f.name}/` : `📄 ${f.name} (${f.language || "text"})`));
        if (fileList.length === 0) {
          newOutput.push("(empty project)");
        } else {
          newOutput.push(...fileList);
        }
        break;
      }

      case "cat": {
        const targetName = args[0];
        if (!targetName) {
          newOutput.push("Usage: cat <filename>");
        } else {
          const found = files.find(
            (f) =>
              f.name === targetName ||
              f.path === targetName ||
              f.path === `/${targetName}`
          );
          if (!found) {
            newOutput.push(`cat: ${targetName}: No such file in project`);
          } else if (found.isFolder) {
            newOutput.push(`cat: ${targetName}: Is a directory`);
          } else {
            newOutput.push(found.content || "(empty file)");
          }
        }
        break;
      }

      case "status":
        newOutput.push(
          `Project:      ${projectName}`,
          `Active File:  ${activeFile ? activeFile.name : "None"}`,
          `Language:     ${activeFile ? activeFile.language : "N/A"}`,
          `Total Files:  ${files.filter((f) => !f.isFolder && f.name !== ".cocode-keep").length}`,
          `Runner:       Judge0 Isolated Execution Engine (Ready)`,
          `Security:     Restricted sandbox mode (host protected)`
        );
        break;

      case "whoami":
        newOutput.push(userName);
        break;

      case "date":
        newOutput.push(new Date().toUTCString());
        break;

      case "echo":
        newOutput.push(args.join(" "));
        break;

      default:
        newOutput.push(
          `cocode: command not found: '${command}'. Type 'help' for available commands.`
        );
        break;
    }

    setLines(newOutput);
    setInputVal("");
  }

  function handleKeyDown(e) {
    if (e.key === "Enter") {
      e.preventDefault();
      handleCommand(inputVal);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      if (history.length === 0) return;
      const nextIdx =
        historyIdx === -1 ? history.length - 1 : Math.max(0, historyIdx - 1);
      setHistoryIdx(nextIdx);
      setInputVal(history[nextIdx] || "");
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      if (historyIdx === -1) return;
      const nextIdx = historyIdx + 1;
      if (nextIdx >= history.length) {
        setHistoryIdx(-1);
        setInputVal("");
      } else {
        setHistoryIdx(nextIdx);
        setInputVal(history[nextIdx]);
      }
    }
  }

  return (
    <div
      className="ide-terminal-console-root"
      onClick={() => inputRef.current?.focus()}
    >
      <div className="ide-terminal-header-bar">
        <div className="ide-terminal-title-group">
          <Terminal size={14} className="text-sky" />
          <span>bash — 80x24 (CoCode Sandbox)</span>
        </div>

        <div className="ide-terminal-badge-group">
          <span className="ide-terminal-security-badge" title="Commands execute securely in isolation">
            <ShieldCheck size={12} color="#10b981" />
            <span>Sandboxed Runner</span>
          </span>

          <button
            type="button"
            className="ide-terminal-btn"
            onClick={(e) => {
              e.stopPropagation();
              setLines([]);
            }}
            title="Clear Terminal Output"
          >
            <Trash2 size={12} />
            <span>Clear</span>
          </button>
        </div>
      </div>

      <div className="ide-terminal-scroll-area">
        {lines.map((l, i) => (
          <div key={i} className="ide-terminal-line">
            {l.startsWith("cocode@ide:~$ ") ? (
              <span className="ide-terminal-prompt-echo">
                <span className="ide-term-user">cocode@ide</span>
                <span className="ide-term-sep">:</span>
                <span className="ide-term-path">~$</span>{" "}
                <span className="ide-term-cmd">{l.replace("cocode@ide:~$ ", "")}</span>
              </span>
            ) : l.startsWith("Error:") ? (
              <span className="ide-term-error">{l}</span>
            ) : (
              <span>{l}</span>
            )}
          </div>
        ))}

        {/* Active Input Line */}
        <div className="ide-terminal-input-row">
          <span className="ide-term-user">cocode@ide</span>
          <span className="ide-term-sep">:</span>
          <span className="ide-term-path">~$</span>
          <input
            ref={inputRef}
            className="ide-terminal-input"
            value={inputVal}
            onChange={(e) => setInputVal(e.target.value)}
            onKeyDown={handleKeyDown}
            autoFocus
            spellCheck={false}
          />
        </div>
        <div ref={terminalEndRef} />
      </div>
    </div>
  );
}
