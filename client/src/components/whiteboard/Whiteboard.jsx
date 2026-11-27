import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  MousePointer2,
  Pencil,
  Eraser,
  Square,
  Circle,
  Minus,
  ArrowUpRight,
  Type,
  Undo2,
  Redo2,
  Trash2,
  Download,
  Sun,
  Moon,
  Wifi,
  WifiOff,
  LoaderCircle,
} from "lucide-react";
import ConfirmModal from "../ide/ConfirmModal.jsx";
import {
  COLOR_PALETTE,
  LOGICAL_HEIGHT,
  LOGICAL_WIDTH,
  STROKE_SIZES,
  computeRedoTransition,
  computeUndoTransition,
  createElementId,
  drawElement,
  findHitElement,
  moveElement,
  renderScene,
  screenToLogical,
  upsertElementInList,
} from "./whiteboardUtils.js";
import "./Whiteboard.css";

const TOOLS = [
  { id: "select", label: "Select & Move (V)", icon: MousePointer2 },
  { id: "pencil", label: "Freehand Pencil (P)", icon: Pencil },
  { id: "eraser", label: "Eraser (E)", icon: Eraser },
  { id: "rect", label: "Rectangle (R)", icon: Square },
  { id: "circle", label: "Circle / Ellipse (C)", icon: Circle },
  { id: "line", label: "Straight Line (L)", icon: Minus },
  { id: "arrow", label: "Arrow (A)", icon: ArrowUpRight },
  { id: "text", label: "Text (T)", icon: Type },
];

export default function Whiteboard({
  socket,
  roomId,
  user,
  connectionStatus = "disconnected",
  onToast,
}) {
  const [tool, setTool] = useState("pencil");
  const [color, setColor] = useState("#38bdf8");
  const [strokeWidth, setStrokeWidth] = useState(4);
  const [canvasTheme, setCanvasTheme] = useState("dark"); // "dark" | "light"

  const [elements, setElements] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [undoStack, setUndoStack] = useState([]);
  const [redoStack, setRedoStack] = useState([]);
  const [isSyncing, setIsSyncing] = useState(() => Boolean(roomId));
  const [clearModalOpen, setClearModalOpen] = useState(false);

  // Text tool inline editor state
  const [textDraft, setTextDraft] = useState(null); // { x, y, screenX, screenY, value }
  const textInputRef = useRef(null);

  const canvasRef = useRef(null);
  const elementsRef = useRef(elements);
  const selectedIdRef = useRef(selectedId);
  const activeElementRef = useRef(null);
  const dragStateRef = useRef(null); // { elementId, startX, startY, originalElement }
  const remotePreviewsRef = useRef(new Map()); // senderId -> { element, timerId }
  const lastPreviewEmitRef = useRef(0);
  const rafIdRef = useRef(null);

  elementsRef.current = elements;
  selectedIdRef.current = selectedId;

  const scheduleRedraw = useCallback(() => {
    if (rafIdRef.current !== null) return;
    rafIdRef.current = window.requestAnimationFrame(() => {
      rafIdRef.current = null;
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      const previews = [];
      for (const entry of remotePreviewsRef.current.values()) {
        if (entry?.element) previews.push(entry.element);
      }
      if (activeElementRef.current) {
        previews.push(activeElementRef.current);
      }

      renderScene(ctx, elementsRef.current, previews, selectedIdRef.current);
    });
  }, []);

  // Configure high-DPI logical canvas once on mount
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = LOGICAL_WIDTH * dpr;
    canvas.height = LOGICAL_HEIGHT * dpr;
    const ctx = canvas.getContext("2d");
    if (ctx) {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    scheduleRedraw();
  }, [scheduleRedraw]);

  // Redraw whenever committed elements or selection change
  useEffect(() => {
    scheduleRedraw();
  }, [elements, selectedId, scheduleRedraw]);

  // Cleanup RAF & preview timers on unmount
  useEffect(() => {
    const previewsMap = remotePreviewsRef.current;
    return () => {
      if (rafIdRef.current !== null) {
        window.cancelAnimationFrame(rafIdRef.current);
        rafIdRef.current = null;
      }
      for (const entry of previewsMap.values()) {
        if (entry?.timerId) clearTimeout(entry.timerId);
      }
      previewsMap.clear();
    };
  }, []);

  // Real-time Socket.IO synchronization
  useEffect(() => {
    if (!socket || !roomId) {
      setIsSyncing(false);
      return;
    }

    const handleState = (data) => {
      if (data?.roomCode && data.roomCode.toUpperCase() !== roomId.toUpperCase()) return;
      const serverElements = Array.isArray(data?.elements) ? data.elements : [];
      setElements(serverElements);
      setIsSyncing(false);
    };

    const handleRemoteAdd = (data) => {
      const el = data?.element;
      if (!el || !el.id) return;
      if (data.sentBy && data.sentBy === user?.id) return;

      if (data.sentBy && remotePreviewsRef.current.has(data.sentBy)) {
        const prevEntry = remotePreviewsRef.current.get(data.sentBy);
        if (prevEntry?.timerId) clearTimeout(prevEntry.timerId);
        remotePreviewsRef.current.delete(data.sentBy);
      }

      setElements((prev) => upsertElementInList(prev, el));
    };

    const handleRemoteUpdate = (data) => {
      const el = data?.element;
      if (!el || !el.id) return;
      if (data.sentBy && data.sentBy === user?.id) return;
      setElements((prev) => upsertElementInList(prev, el));
    };

    const handleRemoteDelete = (data) => {
      const elementId = data?.elementId;
      if (!elementId) return;
      if (data.sentBy && data.sentBy === user?.id) return;
      setElements((prev) => prev.filter((item) => item.id !== elementId));
      setSelectedId((cur) => (cur === elementId ? null : cur));
    };

    const handleRemotePreview = (data) => {
      const el = data?.element;
      const senderId = data?.sentBy;
      if (!el || !senderId || senderId === user?.id) return;

      const existing = remotePreviewsRef.current.get(senderId);
      if (existing?.timerId) clearTimeout(existing.timerId);

      const timerId = setTimeout(() => {
        remotePreviewsRef.current.delete(senderId);
        scheduleRedraw();
      }, 2000);

      remotePreviewsRef.current.set(senderId, { element: el, timerId });
      scheduleRedraw();
    };

    const handleRemoteClear = (data) => {
      if (data?.clearedBy && data.clearedBy === user?.id) return;
      setElements([]);
      setSelectedId(null);
      setUndoStack([]);
      setRedoStack([]);
      remotePreviewsRef.current.clear();
      if (onToast) {
        onToast(`${data?.clearedByName || "A collaborator"} cleared the whiteboard.`);
      }
    };

    const handleWhiteboardError = (err) => {
      if (err?.message && onToast) {
        onToast(err.message);
      }
    };

    const requestSync = () => {
      if (socket.connected) {
        setIsSyncing(true);
        socket.emit("whiteboard:sync");
      }
    };

    socket.on("whiteboard:state", handleState);
    socket.on("whiteboard:element:add", handleRemoteAdd);
    socket.on("whiteboard:element:update", handleRemoteUpdate);
    socket.on("whiteboard:element:delete", handleRemoteDelete);
    socket.on("whiteboard:preview", handleRemotePreview);
    socket.on("whiteboard:clear", handleRemoteClear);
    socket.on("whiteboard:error", handleWhiteboardError);
    socket.on("connect", requestSync);

    requestSync();

    return () => {
      socket.off("whiteboard:state", handleState);
      socket.off("whiteboard:element:add", handleRemoteAdd);
      socket.off("whiteboard:element:update", handleRemoteUpdate);
      socket.off("whiteboard:element:delete", handleRemoteDelete);
      socket.off("whiteboard:preview", handleRemotePreview);
      socket.off("whiteboard:clear", handleRemoteClear);
      socket.off("whiteboard:error", handleWhiteboardError);
      socket.off("connect", requestSync);
    };
  }, [socket, roomId, user?.id, onToast, scheduleRedraw]);

  const emitSocket = useCallback(
    (event, payload) => {
      if (socket && roomId && socket.connected) {
        socket.emit(event, payload);
      }
    },
    [socket, roomId]
  );

  // Commit a newly created element
  const commitNewElement = useCallback(
    (element) => {
      setElements((prev) => upsertElementInList(prev, element));
      setUndoStack((prev) => [...prev.slice(-99), { type: "add", element }]);
      setRedoStack([]);
      emitSocket("whiteboard:element:add", { element });
    },
    [emitSocket]
  );

  // Undo (local user's own actions only)
  const handleUndo = useCallback(() => {
    if (undoStack.length === 0) return;
    const action = undoStack[undoStack.length - 1];
    const { elements: nextElements, socketOp } = computeUndoTransition(elementsRef.current, action);
    setElements(nextElements);
    setUndoStack((prev) => prev.slice(0, -1));
    setRedoStack((prev) => [...prev.slice(-99), action]);
    setSelectedId(null);
    if (socketOp) {
      emitSocket(socketOp.event, socketOp.payload);
    }
  }, [undoStack, emitSocket]);

  // Redo (local user's own actions only)
  const handleRedo = useCallback(() => {
    if (redoStack.length === 0) return;
    const action = redoStack[redoStack.length - 1];
    const { elements: nextElements, socketOp } = computeRedoTransition(elementsRef.current, action);
    setElements(nextElements);
    setRedoStack((prev) => prev.slice(0, -1));
    setUndoStack((prev) => [...prev.slice(-99), action]);
    setSelectedId(null);
    if (socketOp) {
      emitSocket(socketOp.event, socketOp.payload);
    }
  }, [redoStack, emitSocket]);

  // Delete currently selected element
  const handleDeleteSelected = useCallback(() => {
    if (!selectedId) return;
    const target = elementsRef.current.find((el) => el.id === selectedId);
    if (!target) return;
    setElements((prev) => prev.filter((el) => el.id !== selectedId));
    setUndoStack((prev) => [...prev.slice(-99), { type: "delete", element: target }]);
    setRedoStack([]);
    setSelectedId(null);
    emitSocket("whiteboard:element:delete", { elementId: target.id });
  }, [selectedId, emitSocket]);

  // Keyboard shortcuts while whiteboard is active
  useEffect(() => {
    const onKeyDown = (e) => {
      if (textDraft) return;
      const tag = e.target?.tagName?.toLowerCase();
      if (tag === "input" || tag === "textarea") return;

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z" && !e.shiftKey) {
        e.preventDefault();
        handleUndo();
        return;
      }
      if (
        ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "y") ||
        ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === "z")
      ) {
        e.preventDefault();
        handleRedo();
        return;
      }
      if ((e.key === "Delete" || e.key === "Backspace") && selectedIdRef.current) {
        e.preventDefault();
        handleDeleteSelected();
        return;
      }

      const keyMap = {
        v: "select",
        p: "pencil",
        e: "eraser",
        r: "rect",
        c: "circle",
        l: "line",
        a: "arrow",
        t: "text",
      };
      const mapped = keyMap[e.key.toLowerCase()];
      if (mapped && !e.ctrlKey && !e.metaKey && !e.altKey) {
        setTool(mapped);
        if (mapped !== "select") setSelectedId(null);
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [handleUndo, handleRedo, handleDeleteSelected, textDraft]);

  // Focus text input only when newly opened
  const isTextDraftOpen = Boolean(textDraft);
  useEffect(() => {
    if (isTextDraftOpen && textInputRef.current) {
      textInputRef.current.focus();
    }
  }, [isTextDraftOpen]);

  const commitTextDraft = useCallback(() => {
    if (!textDraft) return;
    const trimmed = textDraft.value.trim();
    if (trimmed) {
      const el = {
        id: createElementId(),
        type: "text",
        x: textDraft.x,
        y: textDraft.y,
        text: trimmed,
        color,
        strokeWidth,
        fontSize: Math.max(16, Math.min(48, strokeWidth * 3 + 12)),
      };
      commitNewElement(el);
    }
    setTextDraft(null);
  }, [textDraft, color, strokeWidth, commitNewElement]);

  // Pointer event handlers (supports mouse, touch, stylus)
  const handlePointerDown = (e) => {
    if (e.button !== 0 && e.pointerType === "mouse") return;
    if (textDraft) {
      commitTextDraft();
      return;
    }

    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const pt = screenToLogical(e.clientX, e.clientY, rect);

    if (tool === "text") {
      return;
    }

    try {
      canvas.setPointerCapture(e.pointerId);
    } catch {
      // Ignore if pointer capture is unavailable
    }

    if (tool === "select") {
      const hit = findHitElement(elementsRef.current, pt.x, pt.y);
      if (hit) {
        setSelectedId(hit.id);
        dragStateRef.current = {
          elementId: hit.id,
          startX: pt.x,
          startY: pt.y,
          originalElement: hit,
          movedElement: hit,
        };
      } else {
        setSelectedId(null);
        dragStateRef.current = null;
      }
      return;
    }

    setSelectedId(null);
    const id = createElementId();

    if (tool === "pencil" || tool === "eraser") {
      activeElementRef.current = {
        id,
        type: tool,
        color,
        strokeWidth,
        points: [pt],
      };
    } else {
      activeElementRef.current = {
        id,
        type: tool,
        color,
        strokeWidth,
        x1: pt.x,
        y1: pt.y,
        x2: pt.x,
        y2: pt.y,
      };
    }

    scheduleRedraw();
  };

  const handlePointerMove = (e) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const pt = screenToLogical(e.clientX, e.clientY, rect);

    if (tool === "select" && dragStateRef.current) {
      const dx = pt.x - dragStateRef.current.startX;
      const dy = pt.y - dragStateRef.current.startY;
      const moved = moveElement(dragStateRef.current.originalElement, dx, dy);
      dragStateRef.current.movedElement = moved;
      elementsRef.current = upsertElementInList(elementsRef.current, moved);
      scheduleRedraw();
      return;
    }

    const active = activeElementRef.current;
    if (!active) return;

    if (active.type === "pencil" || active.type === "eraser") {
      const pts = active.points;
      const last = pts[pts.length - 1];
      if (!last || Math.hypot(pt.x - last.x, pt.y - last.y) >= 1.5) {
        pts.push(pt);
      }
    } else {
      active.x2 = pt.x;
      active.y2 = pt.y;
    }

    scheduleRedraw();

    // Throttled live preview broadcast (max ~25fps)
    const now = Date.now();
    if (now - lastPreviewEmitRef.current >= 40) {
      lastPreviewEmitRef.current = now;
      emitSocket("whiteboard:preview", { element: active });
    }
  };

  const handlePointerUp = (e) => {
    const canvas = canvasRef.current;
    if (canvas) {
      try {
        if (canvas.hasPointerCapture(e.pointerId)) {
          canvas.releasePointerCapture(e.pointerId);
        }
      } catch {
        // Ignore
      }
    }

    if (tool === "select" && dragStateRef.current) {
      const { originalElement, movedElement } = dragStateRef.current;
      dragStateRef.current = null;
      if (movedElement && JSON.stringify(originalElement) !== JSON.stringify(movedElement)) {
        setElements((prev) => upsertElementInList(prev, movedElement));
        setUndoStack((prev) => [
          ...prev.slice(-99),
          { type: "update", before: originalElement, after: movedElement },
        ]);
        setRedoStack([]);
        emitSocket("whiteboard:element:update", { element: movedElement });
      }
      return;
    }

    const active = activeElementRef.current;
    if (!active) return;
    activeElementRef.current = null;

    // Ignore zero-size accidental shape clicks
    if (
      (active.type === "rect" ||
        active.type === "circle" ||
        active.type === "line" ||
        active.type === "arrow") &&
      Math.hypot(active.x2 - active.x1, active.y2 - active.y1) < 3
    ) {
      scheduleRedraw();
      return;
    }

    commitNewElement(active);
  };

  const handleCanvasClick = (e) => {
    if (tool !== "text" || textDraft) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const pt = screenToLogical(e.clientX, e.clientY, rect);
    setTextDraft({
      x: pt.x,
      y: Math.max(28, pt.y),
      screenX: ((pt.x / LOGICAL_WIDTH) * 100).toFixed(2),
      screenY: ((pt.y / LOGICAL_HEIGHT) * 100).toFixed(2),
      value: "",
    });
  };

  const handleClearConfirm = () => {
    setClearModalOpen(false);
    setElements([]);
    setSelectedId(null);
    setUndoStack([]);
    setRedoStack([]);
    activeElementRef.current = null;
    emitSocket("whiteboard:clear", {});
    if (onToast) onToast("Whiteboard cleared.");
  };

  const handleExportPng = () => {
    if (elements.length === 0) {
      if (onToast) {
        onToast("Whiteboard is empty — draw something before exporting.");
      }
      return;
    }

    const exportCanvas = document.createElement("canvas");
    exportCanvas.width = LOGICAL_WIDTH;
    exportCanvas.height = LOGICAL_HEIGHT;
    const exportCtx = exportCanvas.getContext("2d");

    const drawLayer = document.createElement("canvas");
    drawLayer.width = LOGICAL_WIDTH;
    drawLayer.height = LOGICAL_HEIGHT;
    const drawCtx = drawLayer.getContext("2d");

    if (!exportCtx || !drawCtx) return;

    // Fill background
    exportCtx.fillStyle = canvasTheme === "dark" ? "#0b1120" : "#ffffff";
    exportCtx.fillRect(0, 0, LOGICAL_WIDTH, LOGICAL_HEIGHT);

    // Draw elements onto transparent layer so eraser strokes don't punch through background
    for (const el of elements) {
      drawElement(drawCtx, el);
    }
    exportCtx.drawImage(drawLayer, 0, 0);

    const dataUrl = exportCanvas.toDataURL("image/png");
    const link = document.createElement("a");
    link.download = `cocode-whiteboard-${roomId || "local"}.png`;
    link.href = dataUrl;
    link.click();
    if (onToast) onToast("Whiteboard exported as PNG.");
  };

  const handleThemeToggle = () => {
    setCanvasTheme((prev) => {
      const next = prev === "dark" ? "light" : "dark";
      if (next === "light" && color === "#f8fafc") setColor("#0f172a");
      if (next === "dark" && color === "#0f172a") setColor("#f8fafc");
      return next;
    });
  };

  return (
    <section className="wb-container" aria-label="Collaborative Whiteboard">
      {/* Top Toolbar */}
      <div className="wb-toolbar" role="toolbar" aria-label="Whiteboard drawing tools">
        {/* Drawing Tools */}
        <div className="wb-tool-group">
          {TOOLS.map((item) => {
            const Icon = item.icon;
            const isActive = tool === item.id;
            return (
              <button
                key={item.id}
                type="button"
                className={`wb-tool-btn ${isActive ? "active" : ""}`}
                onClick={() => {
                  setTool(item.id);
                  if (item.id !== "select") setSelectedId(null);
                }}
                title={item.label}
                aria-label={item.label}
                aria-pressed={isActive}
              >
                <Icon size={16} />
              </button>
            );
          })}
        </div>

        <div className="wb-divider" />

        {/* Color Palette & Custom Picker */}
        <div className="wb-tool-group" aria-label="Color selector">
          {COLOR_PALETTE.map((swatch) => (
            <button
              key={swatch}
              type="button"
              className={`wb-color-swatch ${color === swatch ? "active" : ""}`}
              style={{ backgroundColor: swatch }}
              onClick={() => setColor(swatch)}
              title={`Color ${swatch}`}
              aria-label={`Select color ${swatch}`}
              aria-pressed={color === swatch}
            />
          ))}
          <label className="wb-custom-color" title="Custom Color Picker">
            <input
              type="color"
              value={color}
              onChange={(e) => setColor(e.target.value)}
              aria-label="Custom color picker"
            />
          </label>
        </div>

        <div className="wb-divider" />

        {/* Brush Size Selector */}
        <div className="wb-tool-group wb-size-group" aria-label="Brush size">
          {STROKE_SIZES.map((sz) => (
            <button
              key={sz}
              type="button"
              className={`wb-size-btn ${strokeWidth === sz ? "active" : ""}`}
              onClick={() => setStrokeWidth(sz)}
              title={`Stroke width ${sz}px`}
              aria-label={`Stroke width ${sz}px`}
              aria-pressed={strokeWidth === sz}
            >
              <span
                className="wb-size-dot"
                style={{
                  width: Math.min(14, Math.max(4, sz)),
                  height: Math.min(14, Math.max(4, sz)),
                }}
              />
            </button>
          ))}
          <input
            type="range"
            min={1}
            max={32}
            value={strokeWidth}
            onChange={(e) => setStrokeWidth(Number(e.target.value))}
            className="wb-size-slider"
            title={`Stroke size: ${strokeWidth}px`}
            aria-label="Stroke size slider"
          />
          <span className="wb-size-label">{strokeWidth}px</span>
        </div>

        <div className="wb-divider" />

        {/* History & Actions */}
        <div className="wb-tool-group">
          <button
            type="button"
            className="wb-tool-btn"
            onClick={handleUndo}
            disabled={undoStack.length === 0}
            title="Undo (Ctrl+Z)"
            aria-label="Undo"
          >
            <Undo2 size={16} />
          </button>
          <button
            type="button"
            className="wb-tool-btn"
            onClick={handleRedo}
            disabled={redoStack.length === 0}
            title="Redo (Ctrl+Y)"
            aria-label="Redo"
          >
            <Redo2 size={16} />
          </button>
          {selectedId && (
            <button
              type="button"
              className="wb-tool-btn wb-btn-danger"
              onClick={handleDeleteSelected}
              title="Delete Selected (Del)"
              aria-label="Delete selected element"
            >
              <Trash2 size={16} />
            </button>
          )}
          <button
            type="button"
            className="wb-tool-btn"
            onClick={handleThemeToggle}
            title={canvasTheme === "dark" ? "Switch to Light Canvas" : "Switch to Dark Canvas"}
            aria-label="Toggle canvas theme"
          >
            {canvasTheme === "dark" ? <Sun size={16} /> : <Moon size={16} />}
          </button>
          <button
            type="button"
            className="wb-tool-btn"
            onClick={handleExportPng}
            title="Export Whiteboard as PNG"
            aria-label="Export PNG"
          >
            <Download size={16} />
          </button>
          <button
            type="button"
            className="wb-tool-btn wb-btn-danger"
            onClick={() => setClearModalOpen(true)}
            disabled={elements.length === 0}
            title="Clear Canvas"
            aria-label="Clear Canvas"
          >
            <Trash2 size={16} />
            <span className="wb-btn-text">Clear</span>
          </button>
        </div>

        {/* Connection Status Pill */}
        {roomId && (
          <div className={`wb-sync-pill ${connectionStatus === "connected" ? "online" : "offline"}`}>
            {isSyncing ? (
              <>
                <LoaderCircle size={12} className="spin" />
                <span>Syncing...</span>
              </>
            ) : connectionStatus === "connected" ? (
              <>
                <Wifi size={12} />
                <span>Live Sync</span>
              </>
            ) : (
              <>
                <WifiOff size={12} />
                <span>Offline</span>
              </>
            )}
          </div>
        )}
      </div>

      {/* Responsive Canvas Stage */}
      <div className="wb-stage-wrapper">
        <div className={`wb-canvas-stage ${canvasTheme === "light" ? "theme-light" : "theme-dark"}`}>
          <canvas
            ref={canvasRef}
            className={`wb-canvas tool-${tool}`}
            onClick={handleCanvasClick}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerUp}
            aria-label="Whiteboard drawing canvas"
          />

          {elements.length === 0 && !isSyncing && !textDraft && (
            <div className="wb-empty-hint" aria-hidden="true">
              <Pencil size={24} />
              <span>Start drawing — changes sync in real time with your room</span>
            </div>
          )}

          {textDraft && (
            <textarea
              ref={textInputRef}
              className="wb-text-overlay"
              style={{
                left: `${textDraft.screenX}%`,
                top: `${textDraft.screenY}%`,
                color,
                fontSize: `${Math.max(14, Math.min(32, strokeWidth * 2 + 12))}px`,
              }}
              value={textDraft.value}
              onChange={(e) => setTextDraft((cur) => (cur ? { ...cur, value: e.target.value } : null))}
              onBlur={commitTextDraft}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  commitTextDraft();
                } else if (e.key === "Escape") {
                  e.preventDefault();
                  setTextDraft(null);
                }
              }}
              placeholder="Type text & press Enter..."
              rows={2}
            />
          )}
        </div>
      </div>

      <ConfirmModal
        isOpen={clearModalOpen}
        title="Clear Whiteboard"
        message="This will clear the whiteboard for everyone in the room. Are you sure?"
        confirmText="Clear Canvas"
        confirmVariant="danger"
        onConfirm={handleClearConfirm}
        onCancel={() => setClearModalOpen(false)}
      />
    </section>
  );
}
