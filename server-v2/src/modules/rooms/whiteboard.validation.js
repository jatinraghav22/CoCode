"use strict";

/**
 * Whiteboard Validation & Sanitization
 *
 * Strictly validates incoming whiteboard drawing payloads before storing
 * in RoomStateStore or broadcasting to room peers.
 */

const ALLOWED_ELEMENT_TYPES = new Set([
  "pencil",
  "eraser",
  "rect",
  "circle",
  "line",
  "arrow",
  "text",
]);

const MAX_WHITEBOARD_PAYLOAD_BYTES = 64 * 1024; // 64 KB per event
const MAX_POINTS_PER_STROKE = 5000;
const MAX_TEXT_LENGTH = 2000;
const MAX_ELEMENTS_PER_ROOM = 2000;
const MIN_COORD = -5000;
const MAX_COORD = 10000;
const MIN_STROKE_WIDTH = 1;
const MAX_STROKE_WIDTH = 64;
const MIN_FONT_SIZE = 8;
const MAX_FONT_SIZE = 96;

const ELEMENT_ID_REGEX = /^[a-zA-Z0-9_-]{4,80}$/;
const COLOR_REGEX = /^(#[0-9a-fA-F]{3,8}|rgb\(\s*\d{1,3}\s*,\s*\d{1,3}\s*,\s*\d{1,3}\s*\)|rgba\(\s*\d{1,3}\s*,\s*\d{1,3}\s*,\s*\d{1,3}\s*,\s*(0|1|0?\.\d+)\s*\)|transparent)$/;

function isValidCoord(val) {
  return typeof val === "number" && Number.isFinite(val) && val >= MIN_COORD && val <= MAX_COORD;
}

/**
 * Validates and sanitizes a whiteboard element payload.
 * Returns `{ valid: true, element }` or `{ valid: false, error }`.
 *
 * @param {unknown} raw
 * @param {Object} [author]
 * @param {string} [author.userId]
 * @param {string} [author.userName]
 * @returns {{ valid: true, element: Object } | { valid: false, error: string }}
 */
function validateWhiteboardElement(raw, author = {}) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return { valid: false, error: "Whiteboard element must be an object." };
  }

  let serializedSize = 0;
  try {
    serializedSize = Buffer.byteLength(JSON.stringify(raw), "utf8");
  } catch {
    return { valid: false, error: "Invalid whiteboard payload." };
  }

  if (serializedSize > MAX_WHITEBOARD_PAYLOAD_BYTES) {
    return { valid: false, error: "Whiteboard element exceeds 64 KB payload limit." };
  }

  const { id, type, color, strokeWidth } = raw;

  if (typeof id !== "string" || !ELEMENT_ID_REGEX.test(id)) {
    return { valid: false, error: "Invalid element id." };
  }

  if (typeof type !== "string" || !ALLOWED_ELEMENT_TYPES.has(type)) {
    return { valid: false, error: "Unsupported whiteboard element type." };
  }

  const safeColor = typeof color === "string" && COLOR_REGEX.test(color.trim())
    ? color.trim()
    : "#f8fafc";

  const numericStroke = Number(strokeWidth);
  if (!Number.isFinite(numericStroke) || numericStroke < MIN_STROKE_WIDTH || numericStroke > MAX_STROKE_WIDTH) {
    return { valid: false, error: "Invalid strokeWidth." };
  }

  const base = {
    id,
    type,
    color: safeColor,
    strokeWidth: Math.round(numericStroke * 100) / 100,
    authorId: author.userId || null,
    authorName: author.userName || "Developer",
    updatedAt: Date.now(),
  };

  if (type === "pencil" || type === "eraser") {
    if (!Array.isArray(raw.points) || raw.points.length === 0) {
      return { valid: false, error: "Stroke points must be a non-empty array." };
    }
    if (raw.points.length > MAX_POINTS_PER_STROKE) {
      return { valid: false, error: "Stroke exceeds maximum point count." };
    }

    const sanitizedPoints = [];
    for (const pt of raw.points) {
      if (!pt || typeof pt !== "object" || !isValidCoord(pt.x) || !isValidCoord(pt.y)) {
        return { valid: false, error: "Invalid point coordinates." };
      }
      sanitizedPoints.push({
        x: Math.round(pt.x * 100) / 100,
        y: Math.round(pt.y * 100) / 100,
      });
    }

    return {
      valid: true,
      element: {
        ...base,
        points: sanitizedPoints,
      },
    };
  }

  if (type === "rect" || type === "circle" || type === "line" || type === "arrow") {
    if (!isValidCoord(raw.x1) || !isValidCoord(raw.y1) || !isValidCoord(raw.x2) || !isValidCoord(raw.y2)) {
      return { valid: false, error: "Invalid shape coordinates." };
    }

    return {
      valid: true,
      element: {
        ...base,
        x1: Math.round(raw.x1 * 100) / 100,
        y1: Math.round(raw.y1 * 100) / 100,
        x2: Math.round(raw.x2 * 100) / 100,
        y2: Math.round(raw.y2 * 100) / 100,
      },
    };
  }

  if (type === "text") {
    if (!isValidCoord(raw.x) || !isValidCoord(raw.y)) {
      return { valid: false, error: "Invalid text coordinates." };
    }
    if (typeof raw.text !== "string") {
      return { valid: false, error: "Text content must be a string." };
    }
    const trimmed = raw.text.slice(0, MAX_TEXT_LENGTH);
    if (trimmed.trim().length === 0) {
      return { valid: false, error: "Text content cannot be empty." };
    }

    const rawFontSize = raw.fontSize !== undefined ? Number(raw.fontSize) : 20;
    const fontSize = Number.isFinite(rawFontSize)
      ? Math.max(MIN_FONT_SIZE, Math.min(MAX_FONT_SIZE, Math.round(rawFontSize)))
      : 20;

    return {
      valid: true,
      element: {
        ...base,
        x: Math.round(raw.x * 100) / 100,
        y: Math.round(raw.y * 100) / 100,
        text: trimmed,
        fontSize,
      },
    };
  }

  return { valid: false, error: "Invalid whiteboard element." };
}

/**
 * Validates an element ID string.
 * @param {unknown} elementId
 * @returns {boolean}
 */
function isValidElementId(elementId) {
  return typeof elementId === "string" && ELEMENT_ID_REGEX.test(elementId);
}

module.exports = {
  ALLOWED_ELEMENT_TYPES,
  MAX_ELEMENTS_PER_ROOM,
  MAX_WHITEBOARD_PAYLOAD_BYTES,
  MAX_POINTS_PER_STROKE,
  MAX_TEXT_LENGTH,
  validateWhiteboardElement,
  isValidElementId,
};
