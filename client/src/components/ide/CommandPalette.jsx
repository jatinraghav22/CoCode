import React, { useState, useEffect, useRef, useMemo } from "react";
import { Search, Code } from "lucide-react";

export default function CommandPalette({
  isOpen,
  onClose,
  commands = [],
}) {
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef(null);
  const listRef = useRef(null);

  useEffect(() => {
    if (isOpen) {
      setQuery("");
      setSelectedIndex(0);
      setTimeout(() => {
        inputRef.current?.focus();
      }, 50);
    }
  }, [isOpen]);

  const filteredCommands = useMemo(() => {
    if (!query.trim()) return commands;
    const q = query.toLowerCase().trim();
    return commands.filter((cmd) => {
      return (
        cmd.label.toLowerCase().includes(q) ||
        (cmd.category && cmd.category.toLowerCase().includes(q)) ||
        (cmd.shortcut && cmd.shortcut.toLowerCase().includes(q))
      );
    });
  }, [commands, query]);

  // Keep selected index in bounds
  useEffect(() => {
    setSelectedIndex(0);
  }, [filteredCommands]);

  function handleKeyDown(e) {
    if (e.key === "Escape") {
      e.preventDefault();
      onClose();
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((prev) =>
        filteredCommands.length === 0 ? 0 : (prev + 1) % filteredCommands.length
      );
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((prev) =>
        filteredCommands.length === 0
          ? 0
          : (prev - 1 + filteredCommands.length) % filteredCommands.length
      );
    } else if (e.key === "Enter") {
      e.preventDefault();
      const selected = filteredCommands[selectedIndex];
      if (selected && selected.action) {
        selected.action();
        onClose();
      }
    }
  }

  // Scroll active item into view
  useEffect(() => {
    if (listRef.current) {
      const activeElement = listRef.current.children[selectedIndex];
      if (activeElement) {
        activeElement.scrollIntoView({ block: "nearest" });
      }
    }
  }, [selectedIndex]);

  if (!isOpen) return null;

  return (
    <div className="ide-palette-backdrop" onClick={onClose}>
      <div
        className="ide-palette-modal glass-panel"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={handleKeyDown}
      >
        <div className="ide-palette-input-wrap">
          <Search size={16} className="text-slate" />
          <input
            ref={inputRef}
            className="ide-palette-input"
            placeholder="Type a command or search actions..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <span className="ide-palette-esc-badge">ESC</span>
        </div>

        <div className="ide-palette-list" ref={listRef}>
          {filteredCommands.length === 0 ? (
            <div className="ide-palette-empty">No matching commands found.</div>
          ) : (
            filteredCommands.map((cmd, idx) => {
              const isSelected = idx === selectedIndex;
              return (
                <div
                  key={cmd.id || cmd.label}
                  className={`ide-palette-item ${isSelected ? "selected" : ""}`}
                  onClick={() => {
                    cmd.action();
                    onClose();
                  }}
                  onMouseEnter={() => setSelectedIndex(idx)}
                >
                  <div className="ide-palette-item-left">
                    {cmd.icon || <Code size={14} className="text-sky" />}
                    <div className="ide-palette-item-text">
                      {cmd.category && (
                        <span className="ide-palette-category">{cmd.category}: </span>
                      )}
                      <span className="ide-palette-label">{cmd.label}</span>
                    </div>
                  </div>

                  {cmd.shortcut && (
                    <span className="ide-palette-shortcut">{cmd.shortcut}</span>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
