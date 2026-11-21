import React, { useState, useEffect, useRef, useMemo } from "react";
import { Search, FileCode, FileText, FileJson } from "lucide-react";

export default function QuickOpen({
  isOpen,
  onClose,
  files = [],
  onSelectFile,
}) {
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef(null);
  const listRef = useRef(null);

  const realFiles = useMemo(() => {
    return files.filter((f) => !f.isFolder && f.name !== ".cocode-keep");
  }, [files]);

  const filteredFiles = useMemo(() => {
    if (!query.trim()) return realFiles;
    const q = query.toLowerCase().trim();
    return realFiles.filter(
      (f) =>
        f.name.toLowerCase().includes(q) ||
        (f.path && f.path.toLowerCase().includes(q))
    );
  }, [realFiles, query]);

  useEffect(() => {
    if (isOpen) {
      setQuery("");
      setSelectedIndex(0);
      setTimeout(() => {
        inputRef.current?.focus();
      }, 50);
    }
  }, [isOpen]);

  useEffect(() => {
    setSelectedIndex(0);
  }, [filteredFiles]);

  function handleKeyDown(e) {
    if (e.key === "Escape") {
      e.preventDefault();
      onClose();
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((prev) =>
        filteredFiles.length === 0 ? 0 : (prev + 1) % filteredFiles.length
      );
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((prev) =>
        filteredFiles.length === 0
          ? 0
          : (prev - 1 + filteredFiles.length) % filteredFiles.length
      );
    } else if (e.key === "Enter") {
      e.preventDefault();
      const selected = filteredFiles[selectedIndex];
      if (selected) {
        onSelectFile(selected);
        onClose();
      }
    }
  }

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
            placeholder="Search files by name (Ctrl+P)..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <span className="ide-palette-esc-badge">ESC</span>
        </div>

        <div className="ide-palette-list" ref={listRef}>
          {filteredFiles.length === 0 ? (
            <div className="ide-palette-empty">No matching files found.</div>
          ) : (
            filteredFiles.map((file, idx) => {
              const isSelected = idx === selectedIndex;
              return (
                <div
                  key={file.id || file.path}
                  className={`ide-palette-item ${isSelected ? "selected" : ""}`}
                  onClick={() => {
                    onSelectFile(file);
                    onClose();
                  }}
                  onMouseEnter={() => setSelectedIndex(idx)}
                >
                  <div className="ide-palette-item-left">
                    <FileCode size={14} className="text-sky" />
                    <div className="ide-palette-item-text">
                      <span className="ide-palette-label">{file.name}</span>
                      <span className="ide-palette-subpath">{file.path}</span>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
