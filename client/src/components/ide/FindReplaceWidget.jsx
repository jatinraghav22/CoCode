import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  Search,
  ChevronDown,
  ChevronUp,
  Replace,
  ReplaceAll,
  X,
  CaseSensitive,
  WholeWord,
  Regex,
} from "lucide-react";

export default function FindReplaceWidget({
  isOpen,
  onClose,
  editor,
  initialQuery = "",
}) {
  const [findQuery, setFindQuery] = useState(initialQuery);
  const [replaceQuery, setReplaceQuery] = useState("");
  const [matchCase, setMatchCase] = useState(false);
  const [wholeWord, setWholeWord] = useState(false);
  const [useRegex, setUseRegex] = useState(false);
  const [showReplace, setShowReplace] = useState(true);
  const [matches, setMatches] = useState([]);
  const [currentMatchIndex, setCurrentMatchIndex] = useState(0);

  const findInputRef = useRef(null);

  // Sync initial query if passed
  useEffect(() => {
    if (initialQuery) {
      setFindQuery(initialQuery);
    }
  }, [initialQuery]);

  // Focus input when opened
  useEffect(() => {
    if (isOpen && findInputRef.current) {
      findInputRef.current.focus();
      findInputRef.current.select();
    }
  }, [isOpen]);

  // Execute Monaco find search
  const performSearch = useCallback(() => {
    if (!editor) return;
    const model = editor.getModel();
    if (!model || !findQuery) {
      setMatches([]);
      setCurrentMatchIndex(0);
      return;
    }

    try {
      const found = model.findMatches(
        findQuery,
        false, // searchOnlyEditableRange
        useRegex,
        matchCase,
        wholeWord ? "\\b" : null,
        true // captureMatches
      );

      setMatches(found);

      // Find which match is closest to current cursor
      if (found.length > 0) {
        const cursor = editor.getPosition();
        let closestIndex = 0;
        for (let i = 0; i < found.length; i++) {
          if (found[i].range.startLineNumber >= cursor.lineNumber) {
            closestIndex = i;
            break;
          }
        }
        setCurrentMatchIndex(closestIndex);
        revealMatch(found[closestIndex]);
      } else {
        setCurrentMatchIndex(0);
      }
    } catch {
      // Regex syntax error or invalid pattern
      setMatches([]);
    }
  }, [editor, findQuery, matchCase, wholeWord, useRegex]);

  useEffect(() => {
    if (isOpen) {
      performSearch();
    }
  }, [isOpen, performSearch]);

  function revealMatch(match) {
    if (!editor || !match) return;
    editor.setSelection(match.range);
    editor.revealRangeInCenter(match.range);
  }

  function handleNext() {
    if (matches.length === 0) return;
    const nextIdx = (currentMatchIndex + 1) % matches.length;
    setCurrentMatchIndex(nextIdx);
    revealMatch(matches[nextIdx]);
  }

  function handlePrev() {
    if (matches.length === 0) return;
    const prevIdx = (currentMatchIndex - 1 + matches.length) % matches.length;
    setCurrentMatchIndex(prevIdx);
    revealMatch(matches[prevIdx]);
  }

  function handleReplace() {
    if (!editor || matches.length === 0) return;
    const current = matches[currentMatchIndex];
    if (!current) return;

    editor.executeEdits("find-replace", [
      {
        range: current.range,
        text: replaceQuery,
        forceMoveMarkers: true,
      },
    ]);

    // Re-run search
    performSearch();
  }

  function handleReplaceAll() {
    if (!editor || matches.length === 0) return;
    const edits = matches.map((m) => ({
      range: m.range,
      text: replaceQuery,
      forceMoveMarkers: true,
    }));

    editor.executeEdits("find-replace-all", edits);
    performSearch();
  }

  // Keyboard shortcut handler (Enter for next, Shift+Enter for prev, Escape to close)
  function handleKeyDown(e) {
    if (e.key === "Escape") {
      e.preventDefault();
      onClose();
    } else if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleNext();
    } else if (e.key === "Enter" && e.shiftKey) {
      e.preventDefault();
      handlePrev();
    }
  }

  if (!isOpen) return null;

  return (
    <div className="ide-find-replace-widget glass-panel" onKeyDown={handleKeyDown}>
      {/* Row 1: Find Row */}
      <div className="ide-fr-row">
        <button
          type="button"
          className="ide-fr-toggle-btn"
          onClick={() => setShowReplace(!showReplace)}
          title={showReplace ? "Hide Replace" : "Show Replace"}
        >
          {showReplace ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        </button>

        <div className="ide-fr-input-wrap">
          <input
            ref={findInputRef}
            className="ide-fr-input"
            placeholder="Find in file..."
            value={findQuery}
            onChange={(e) => setFindQuery(e.target.value)}
          />

          <div className="ide-fr-options">
            <button
              type="button"
              className={`ide-fr-option-btn ${matchCase ? "active" : ""}`}
              onClick={() => setMatchCase(!matchCase)}
              title="Match Case (Alt+C)"
            >
              Aa
            </button>
            <button
              type="button"
              className={`ide-fr-option-btn ${wholeWord ? "active" : ""}`}
              onClick={() => setWholeWord(!wholeWord)}
              title="Match Whole Word (Alt+W)"
            >
              \b
            </button>
            <button
              type="button"
              className={`ide-fr-option-btn ${useRegex ? "active" : ""}`}
              onClick={() => setUseRegex(!useRegex)}
              title="Use Regular Expression (Alt+R)"
            >
              .*
            </button>
          </div>
        </div>

        <div className="ide-fr-counter">
          {findQuery ? (
            matches.length > 0 ? (
              <span>
                {currentMatchIndex + 1} of {matches.length}
              </span>
            ) : (
              <span className="no-matches">No results</span>
            )
          ) : null}
        </div>

        <div className="ide-fr-actions">
          <button
            type="button"
            className="ide-fr-btn"
            onClick={handlePrev}
            disabled={matches.length === 0}
            title="Previous Match (Shift+Enter)"
          >
            <ChevronUp size={14} />
          </button>
          <button
            type="button"
            className="ide-fr-btn"
            onClick={handleNext}
            disabled={matches.length === 0}
            title="Next Match (Enter)"
          >
            <ChevronDown size={14} />
          </button>
          <button
            type="button"
            className="ide-fr-btn close"
            onClick={onClose}
            title="Close (Escape)"
          >
            <X size={14} />
          </button>
        </div>
      </div>

      {/* Row 2: Replace Row */}
      {showReplace && (
        <div className="ide-fr-row replace-row">
          <div style={{ width: 18 }} />
          <div className="ide-fr-input-wrap">
            <input
              className="ide-fr-input"
              placeholder="Replace with..."
              value={replaceQuery}
              onChange={(e) => setReplaceQuery(e.target.value)}
            />
          </div>

          <div className="ide-fr-actions replace-actions">
            <button
              type="button"
              className="ide-fr-btn replace-text-btn"
              onClick={handleReplace}
              disabled={matches.length === 0}
              title="Replace Current Match"
            >
              Replace
            </button>
            <button
              type="button"
              className="ide-fr-btn replace-text-btn"
              onClick={handleReplaceAll}
              disabled={matches.length === 0}
              title="Replace All Matches"
            >
              Replace All
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
