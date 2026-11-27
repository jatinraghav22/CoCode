import test from "node:test";
import assert from "node:assert/strict";
import {
  LOGICAL_HEIGHT,
  LOGICAL_WIDTH,
  computeRedoTransition,
  computeUndoTransition,
  findHitElement,
  getElementBounds,
  moveElement,
  screenToLogical,
  upsertElementInList,
} from "../src/components/whiteboard/whiteboardUtils.js";

test("Whiteboard — screenToLogical preserves proportions across different viewport sizes", () => {
  const desktopRect = { left: 0, top: 0, width: 1600, height: 900 };
  const mobileRect = { left: 20, top: 40, width: 320, height: 180 };

  const p1 = screenToLogical(800, 450, desktopRect);
  const p2 = screenToLogical(20 + 160, 40 + 90, mobileRect);

  assert.deepEqual(p1, { x: LOGICAL_WIDTH / 2, y: LOGICAL_HEIGHT / 2 });
  assert.deepEqual(p2, { x: LOGICAL_WIDTH / 2, y: LOGICAL_HEIGHT / 2 });
});

test("Whiteboard — hitTest and moveElement work for shapes, strokes, and text", () => {
  const rect = { id: "wb-1", type: "rect", x1: 100, y1: 100, x2: 200, y2: 200, strokeWidth: 4 };
  const text = { id: "wb-2", type: "text", x: 300, y: 300, text: "Hello", fontSize: 20 };

  assert.equal(findHitElement([rect, text], 150, 150)?.id, "wb-1");
  assert.equal(findHitElement([rect, text], 310, 290)?.id, "wb-2");
  assert.equal(findHitElement([rect, text], 50, 50), null);

  const moved = moveElement(rect, 25, -10);
  assert.equal(moved.x1, 125);
  assert.equal(moved.y1, 90);
  assert.equal(getElementBounds(moved).width, 100);
});

test("Whiteboard — upsertElementInList prevents duplicate element entries", () => {
  const el1 = { id: "wb-a", type: "line", x1: 0, y1: 0, x2: 10, y2: 10 };
  const el1Updated = { id: "wb-a", type: "line", x1: 5, y1: 5, x2: 20, y2: 20 };

  let list = upsertElementInList([], el1);
  list = upsertElementInList(list, el1Updated);
  assert.equal(list.length, 1);
  assert.equal(list[0].x2, 20);
});

test("Whiteboard — per-user undo and redo never erase another participant's work", () => {
  const aliceEl = { id: "wb-alice-1", type: "rect", x1: 10, y1: 10, x2: 50, y2: 50, authorId: "alice" };
  const bobEl = { id: "wb-bob-1", type: "circle", x1: 200, y1: 200, x2: 260, y2: 260, authorId: "bob" };

  const sharedElements = [aliceEl, bobEl];
  const aliceAction = { type: "add", element: aliceEl };

  const afterUndo = computeUndoTransition(sharedElements, aliceAction);
  assert.equal(afterUndo.elements.length, 1);
  assert.equal(afterUndo.elements[0].id, "wb-bob-1");
  assert.equal(afterUndo.socketOp.event, "whiteboard:element:delete");

  const afterRedo = computeRedoTransition(afterUndo.elements, aliceAction);
  assert.equal(afterRedo.elements.length, 2);
  assert.equal(afterRedo.socketOp.event, "whiteboard:element:add");
});
