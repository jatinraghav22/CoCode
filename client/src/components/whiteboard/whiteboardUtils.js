/**
 * whiteboardUtils.js — Pure geometry, rendering, hit-testing, and undo/redo
 * helpers for CoCode's Collaborative Whiteboard.
 */

export const LOGICAL_WIDTH = 1600;
export const LOGICAL_HEIGHT = 900;

export const COLOR_PALETTE = [
  "#f8fafc", // Slate White
  "#38bdf8", // Sky Cyan
  "#818cf8", // Indigo
  "#34d399", // Emerald
  "#fbbf24", // Amber
  "#f87171", // Rose Red
  "#f472b6", // Pink
  "#0f172a", // Deep Ink (for light canvas)
];

export const STROKE_SIZES = [2, 4, 8, 14];

export function createElementId() {
  const rand = Math.random().toString(36).slice(2, 8);
  return `wb-${Date.now().toString(36)}-${rand}`;
}

/**
 * Maps screen client coordinates to logical 1600x900 canvas coordinates.
 */
export function screenToLogical(clientX, clientY, rect) {
  if (!rect || rect.width <= 0 || rect.height <= 0) {
    return { x: 0, y: 0 };
  }
  const x = ((clientX - rect.left) / rect.width) * LOGICAL_WIDTH;
  const y = ((clientY - rect.top) / rect.height) * LOGICAL_HEIGHT;
  return {
    x: Math.max(0, Math.min(LOGICAL_WIDTH, Math.round(x * 100) / 100)),
    y: Math.max(0, Math.min(LOGICAL_HEIGHT, Math.round(y * 100) / 100)),
  };
}

/**
 * Computes the axis-aligned bounding box for any whiteboard element.
 */
export function getElementBounds(el) {
  if (!el) return { x: 0, y: 0, width: 0, height: 0 };

  if (el.type === "pencil" || el.type === "eraser") {
    const pts = el.points || [];
    if (pts.length === 0) return { x: 0, y: 0, width: 0, height: 0 };
    let minX = pts[0].x;
    let maxX = pts[0].x;
    let minY = pts[0].y;
    let maxY = pts[0].y;
    for (let i = 1; i < pts.length; i++) {
      if (pts[i].x < minX) minX = pts[i].x;
      if (pts[i].x > maxX) maxX = pts[i].x;
      if (pts[i].y < minY) minY = pts[i].y;
      if (pts[i].y > maxY) maxY = pts[i].y;
    }
    const pad = Math.max(4, (el.strokeWidth || 2) / 2);
    return {
      x: minX - pad,
      y: minY - pad,
      width: Math.max(8, maxX - minX + pad * 2),
      height: Math.max(8, maxY - minY + pad * 2),
    };
  }

  if (el.type === "rect" || el.type === "circle" || el.type === "line" || el.type === "arrow") {
    const minX = Math.min(el.x1, el.x2);
    const minY = Math.min(el.y1, el.y2);
    const maxX = Math.max(el.x1, el.x2);
    const maxY = Math.max(el.y1, el.y2);
    return {
      x: minX,
      y: minY,
      width: Math.max(8, maxX - minX),
      height: Math.max(8, maxY - minY),
    };
  }

  if (el.type === "text") {
    const fontSize = el.fontSize || 20;
    const lines = String(el.text || "").split("\n");
    const longest = lines.reduce((m, l) => Math.max(m, l.length), 1);
    const estWidth = Math.max(40, longest * fontSize * 0.6);
    const estHeight = Math.max(fontSize * 1.2, lines.length * fontSize * 1.3);
    return {
      x: el.x,
      y: el.y - fontSize,
      width: estWidth,
      height: estHeight,
    };
  }

  return { x: 0, y: 0, width: 0, height: 0 };
}

function distToSegment(px, py, x1, y1, x2, y2) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) return Math.hypot(px - x1, py - y1);
  let t = ((px - x1) * dx + (py - y1) * dy) / lenSq;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(px - (x1 + t * dx), py - (y1 + t * dy));
}

/**
 * Returns true if point (x, y) hits the given element.
 */
export function hitTestElement(el, x, y, tolerance = 10) {
  if (!el || el.type === "eraser") return false;
  const hitTol = Math.max(tolerance, (el.strokeWidth || 2) + 6);

  if (el.type === "pencil") {
    const pts = el.points || [];
    if (pts.length === 1) {
      return Math.hypot(x - pts[0].x, y - pts[0].y) <= hitTol;
    }
    for (let i = 1; i < pts.length; i++) {
      if (distToSegment(x, y, pts[i - 1].x, pts[i - 1].y, pts[i].x, pts[i].y) <= hitTol) {
        return true;
      }
    }
    return false;
  }

  if (el.type === "line" || el.type === "arrow") {
    return distToSegment(x, y, el.x1, el.y1, el.x2, el.y2) <= hitTol;
  }

  if (el.type === "rect" || el.type === "circle" || el.type === "text") {
    const b = getElementBounds(el);
    return (
      x >= b.x - 6 &&
      x <= b.x + b.width + 6 &&
      y >= b.y - 6 &&
      y <= b.y + b.height + 6
    );
  }

  return false;
}

/**
 * Finds the topmost selectable element at logical (x, y).
 */
export function findHitElement(elements, x, y) {
  for (let i = elements.length - 1; i >= 0; i--) {
    if (hitTestElement(elements[i], x, y)) {
      return elements[i];
    }
  }
  return null;
}

/**
 * Returns a new element translated by (dx, dy).
 */
export function moveElement(el, dx, dy) {
  if (!el) return el;
  if (el.type === "pencil" || el.type === "eraser") {
    return {
      ...el,
      points: (el.points || []).map((pt) => ({
        x: Math.round((pt.x + dx) * 100) / 100,
        y: Math.round((pt.y + dy) * 100) / 100,
      })),
    };
  }
  if (el.type === "rect" || el.type === "circle" || el.type === "line" || el.type === "arrow") {
    return {
      ...el,
      x1: Math.round((el.x1 + dx) * 100) / 100,
      y1: Math.round((el.y1 + dy) * 100) / 100,
      x2: Math.round((el.x2 + dx) * 100) / 100,
      y2: Math.round((el.y2 + dy) * 100) / 100,
    };
  }
  if (el.type === "text") {
    return {
      ...el,
      x: Math.round((el.x + dx) * 100) / 100,
      y: Math.round((el.y + dy) * 100) / 100,
    };
  }
  return el;
}

/**
 * Draws a single element onto a 2D canvas context.
 */
export function drawElement(ctx, el) {
  if (!ctx || !el) return;

  ctx.save();
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.strokeStyle = el.color || "#f8fafc";
  ctx.fillStyle = el.color || "#f8fafc";
  ctx.lineWidth = el.strokeWidth || 3;

  if (el.type === "eraser") {
    ctx.globalCompositeOperation = "destination-out";
    ctx.strokeStyle = "rgba(0,0,0,1)";
    ctx.lineWidth = Math.max(8, (el.strokeWidth || 4) * 2.5);
  }

  if (el.type === "pencil" || el.type === "eraser") {
    const pts = el.points || [];
    if (pts.length === 0) {
      ctx.restore();
      return;
    }
    ctx.beginPath();
    ctx.moveTo(pts[0].x, pts[0].y);
    if (pts.length === 1) {
      ctx.lineTo(pts[0].x + 0.01, pts[0].y + 0.01);
    } else {
      for (let i = 1; i < pts.length - 1; i++) {
        const midX = (pts[i].x + pts[i + 1].x) / 2;
        const midY = (pts[i].y + pts[i + 1].y) / 2;
        ctx.quadraticCurveTo(pts[i].x, pts[i].y, midX, midY);
      }
      const last = pts[pts.length - 1];
      ctx.lineTo(last.x, last.y);
    }
    ctx.stroke();
  } else if (el.type === "rect") {
    const x = Math.min(el.x1, el.x2);
    const y = Math.min(el.y1, el.y2);
    const w = Math.abs(el.x2 - el.x1);
    const h = Math.abs(el.y2 - el.y1);
    ctx.strokeRect(x, y, w, h);
  } else if (el.type === "circle") {
    const cx = (el.x1 + el.x2) / 2;
    const cy = (el.y1 + el.y2) / 2;
    const rx = Math.abs(el.x2 - el.x1) / 2;
    const ry = Math.abs(el.y2 - el.y1) / 2;
    ctx.beginPath();
    ctx.ellipse(cx, cy, Math.max(0.5, rx), Math.max(0.5, ry), 0, 0, Math.PI * 2);
    ctx.stroke();
  } else if (el.type === "line") {
    ctx.beginPath();
    ctx.moveTo(el.x1, el.y1);
    ctx.lineTo(el.x2, el.y2);
    ctx.stroke();
  } else if (el.type === "arrow") {
    const headLen = Math.max(10, (el.strokeWidth || 3) * 3.5);
    const angle = Math.atan2(el.y2 - el.y1, el.x2 - el.x1);
    ctx.beginPath();
    ctx.moveTo(el.x1, el.y1);
    ctx.lineTo(el.x2, el.y2);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(el.x2, el.y2);
    ctx.lineTo(
      el.x2 - headLen * Math.cos(angle - Math.PI / 6),
      el.y2 - headLen * Math.sin(angle - Math.PI / 6)
    );
    ctx.lineTo(
      el.x2 - headLen * Math.cos(angle + Math.PI / 6),
      el.y2 - headLen * Math.sin(angle + Math.PI / 6)
    );
    ctx.closePath();
    ctx.fill();
  } else if (el.type === "text") {
    const fontSize = el.fontSize || 20;
    ctx.font = `600 ${fontSize}px Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`;
    ctx.textBaseline = "alphabetic";
    const lines = String(el.text || "").split("\n");
    lines.forEach((line, idx) => {
      ctx.fillText(line, el.x, el.y + idx * fontSize * 1.3);
    });
  }

  ctx.restore();
}

/**
 * Renders the full scene (committed elements, live previews, and selection box).
 */
export function renderScene(ctx, elements, previews = [], selectedId = null) {
  if (!ctx) return;
  ctx.clearRect(0, 0, LOGICAL_WIDTH, LOGICAL_HEIGHT);

  for (const el of elements) {
    drawElement(ctx, el);
  }

  for (const preview of previews) {
    if (preview) drawElement(ctx, preview);
  }

  if (selectedId) {
    const selected = elements.find((e) => e.id === selectedId);
    if (selected) {
      const b = getElementBounds(selected);
      ctx.save();
      ctx.strokeStyle = "#38bdf8";
      ctx.lineWidth = 2;
      ctx.setLineDash([6, 4]);
      ctx.strokeRect(b.x - 6, b.y - 6, b.width + 12, b.height + 12);
      ctx.restore();
    }
  }
}

/**
 * Upserts an element into an array by ID without duplicating.
 */
export function upsertElementInList(list, element) {
  const idx = list.findIndex((item) => item.id === element.id);
  if (idx === -1) {
    return [...list, element];
  }
  const next = list.slice();
  next[idx] = element;
  return next;
}

/**
 * Computes next elements list and socket action when undoing a local user action.
 */
export function computeUndoTransition(elements, action) {
  if (!action) return { elements, socketOp: null };

  if (action.type === "add") {
    return {
      elements: elements.filter((el) => el.id !== action.element.id),
      socketOp: { event: "whiteboard:element:delete", payload: { elementId: action.element.id } },
    };
  }

  if (action.type === "delete") {
    return {
      elements: upsertElementInList(elements, action.element),
      socketOp: { event: "whiteboard:element:add", payload: { element: action.element } },
    };
  }

  if (action.type === "update") {
    return {
      elements: upsertElementInList(elements, action.before),
      socketOp: { event: "whiteboard:element:update", payload: { element: action.before } },
    };
  }

  return { elements, socketOp: null };
}

/**
 * Computes next elements list and socket action when redoing a local user action.
 */
export function computeRedoTransition(elements, action) {
  if (!action) return { elements, socketOp: null };

  if (action.type === "add") {
    return {
      elements: upsertElementInList(elements, action.element),
      socketOp: { event: "whiteboard:element:add", payload: { element: action.element } },
    };
  }

  if (action.type === "delete") {
    return {
      elements: elements.filter((el) => el.id !== action.element.id),
      socketOp: { event: "whiteboard:element:delete", payload: { elementId: action.element.id } },
    };
  }

  if (action.type === "update") {
    return {
      elements: upsertElementInList(elements, action.after),
      socketOp: { event: "whiteboard:element:update", payload: { element: action.after } },
    };
  }

  return { elements, socketOp: null };
}
