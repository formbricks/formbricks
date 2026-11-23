/**
 * @vitest-environment jsdom
 */
import { describe, expect, test } from "vitest";
import type { TWorkflowDefinition } from "@formbricks/workflows";
import {
  EMPTY_HISTORY,
  HISTORY_COALESCE_MS,
  HISTORY_LIMIT,
  isTypingTarget,
  recordEdit,
  redoStep,
  undoStep,
} from "./editor-history";

const def = (entryNodeId: string) => ({ entryNodeId }) as unknown as TWorkflowDefinition;

describe("editor history", () => {
  test("an edit can be undone, then redone", () => {
    const a = def("a");
    const b = def("b");
    const history = recordEdit(EMPTY_HISTORY, a, 1_000);

    const undone = undoStep(history, b);
    expect(undone?.definition).toBe(a);

    const redone = redoStep(undone!.history, a);
    expect(redone?.definition).toBe(b);
    expect(redone?.history.past).toEqual([a]);
  });

  test("quick successive edits are one step, so one undo reverts a burst of typing", () => {
    const a = def("a");
    let history = recordEdit(EMPTY_HISTORY, a, 1_000);
    history = recordEdit(history, def("ab"), 1_000 + HISTORY_COALESCE_MS - 1);

    expect(history.past).toEqual([a]);
    expect(undoStep(history, def("abc"))?.definition).toBe(a);
  });

  test("edits further apart are separate steps", () => {
    const a = def("a");
    const b = def("b");
    let history = recordEdit(EMPTY_HISTORY, a, 1_000);
    history = recordEdit(history, b, 1_000 + HISTORY_COALESCE_MS);

    expect(history.past).toEqual([a, b]);
  });

  test("a new edit after an undo clears what could be redone", () => {
    const history = recordEdit(EMPTY_HISTORY, def("a"), 1_000);
    const undone = undoStep(history, def("b"))!;
    const edited = recordEdit(undone.history, def("a"), 5_000);

    expect(edited.future).toEqual([]);
    expect(redoStep(edited, def("c"))).toBeNull();
  });

  test("keeps only the latest steps", () => {
    let history = EMPTY_HISTORY;
    for (let i = 0; i < HISTORY_LIMIT + 5; i++) {
      history = recordEdit(history, def(String(i)), i * HISTORY_COALESCE_MS * 2);
    }
    expect(history.past).toHaveLength(HISTORY_LIMIT);
    expect(history.past[0]).toEqual(def("5"));
  });

  test("nothing to undo or redo returns null", () => {
    expect(undoStep(EMPTY_HISTORY, def("a"))).toBeNull();
    expect(redoStep(EMPTY_HISTORY, def("a"))).toBeNull();
  });

  test("keyboard undo is left to text fields and code editors", () => {
    const input = document.createElement("input");
    const plain = document.createElement("div");
    const codeMirror = document.createElement("div");
    codeMirror.className = "cm-editor";
    const insideCodeMirror = document.createElement("div");
    codeMirror.appendChild(insideCodeMirror);

    expect(isTypingTarget(input)).toBe(true);
    expect(isTypingTarget(insideCodeMirror)).toBe(true);
    expect(isTypingTarget(plain)).toBe(false);
    expect(isTypingTarget(null)).toBe(false);
  });
});
