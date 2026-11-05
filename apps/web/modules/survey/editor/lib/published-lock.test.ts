import { describe, expect, test } from "vitest";
import { getPublishedLockViolations } from "@formbricks/types/surveys/published-lock";
import { getElementLock } from "./published-lock";

const choice = (id: string, text: string, code?: string) => ({ id, label: { default: text }, code });

const element = (overrides: Record<string, unknown> = {}) => ({
  id: "q-one",
  type: "multipleChoiceSingle",
  code: "q1",
  headline: { default: "Pick" },
  choices: [choice("a", "Apple", "1"), choice("b", "Banana", "2"), choice("other", "Other", "98")],
  ...overrides,
});

const survey = (status: string, elements: Record<string, unknown>[]) => ({
  status,
  blocks: [{ id: "block-1", name: "Block 1", elements }],
});

describe("getElementLock", () => {
  test("locks nothing while the persisted survey is a draft", () => {
    const lock = getElementLock(survey("draft", [element()]), "q-one");
    expect(lock.isActive).toBe(false);
    expect(lock.isCodeLocked).toBe(false);
    expect(lock.isTypeLocked).toBe(false);
    expect(lock.isOptionLocked("choices", "a")).toBe(false);
    expect(lock.isOptionTextLocked("choices", "a", "default")).toBe(false);
  });

  test.each(["inProgress", "paused", "completed", "scheduled"])(
    "locks codes, type, option text and option deletion once the persisted survey is %s",
    (status) => {
      const lock = getElementLock(survey(status, [element()]), "q-one");
      expect(lock.isActive).toBe(true);
      expect(lock.isCodeLocked).toBe(true);
      expect(lock.isTypeLocked).toBe(true);
      expect(lock.isOptionLocked("choices", "a")).toBe(true);
      expect(lock.isOptionTextLocked("choices", "a", "default")).toBe(true);
      expect(lock.isAnswerCodeLocked("choices", "b")).toBe(true);
    }
  );

  test("a question or option added since the last save stays editable", () => {
    const published = survey("inProgress", [element()]);
    const newQuestion = getElementLock(published, "q-new");
    expect(newQuestion.isActive).toBe(true);
    expect(newQuestion.isCodeLocked).toBe(false);
    expect(newQuestion.isTypeLocked).toBe(false);

    const lock = getElementLock(published, "q-one");
    expect(lock.isOptionLocked("choices", "added-later")).toBe(false);
    expect(lock.isOptionTextLocked("choices", "added-later", "default")).toBe(false);
    expect(lock.isAnswerCodeLocked("choices", "added-later")).toBe(false);
  });

  test("a code or translation that was never set can still be set", () => {
    const published = survey("inProgress", [
      element({ code: undefined, choices: [{ id: "a", label: { default: "Apple", de: "" } }] }),
    ]);
    const lock = getElementLock(published, "q-one");
    expect(lock.isCodeLocked).toBe(false);
    expect(lock.isAnswerCodeLocked("choices", "a")).toBe(false);
    expect(lock.isOptionTextLocked("choices", "a", "default")).toBe(true);
    expect(lock.isOptionTextLocked("choices", "a", "de")).toBe(false);
    expect(lock.isOptionLocked("choices", "a")).toBe(true);
  });

  test("matrix rows and columns lock like options", () => {
    const matrix = {
      id: "q-grid",
      type: "matrix",
      code: "q2",
      rows: [{ id: "r1", label: { default: "Row" }, code: "1" }],
      columns: [{ id: "c1", label: { default: "Col" }, code: "1" }],
    };
    const lock = getElementLock(survey("paused", [matrix]), "q-grid");
    expect(lock.isOptionLocked("rows", "r1")).toBe(true);
    expect(lock.isOptionTextLocked("columns", "c1", "default")).toBe(true);
    expect(lock.isOptionLocked("rows", "r2")).toBe(false);
  });

  test("agrees with the server lock: what the editor leaves open is accepted, what it locks is refused", () => {
    const stored = survey("inProgress", [element()]);
    const lock = getElementLock(stored, "q-one");

    const withNewOption = survey("inProgress", [
      element({ choices: [...element().choices, choice("c", "Cherry", "3")] }),
    ]);
    expect(getPublishedLockViolations(stored, withNewOption)).toEqual([]);

    const cases = [
      { locked: lock.isCodeLocked, kind: "question_code_changed", edit: element({ code: "renamed" }) },
      {
        locked: lock.isTypeLocked,
        kind: "question_type_changed",
        edit: element({ type: "multipleChoiceMulti" }),
      },
      {
        locked: lock.isOptionTextLocked("choices", "a", "default"),
        kind: "option_text_changed",
        edit: element({ choices: [choice("a", "Apricot", "1"), ...element().choices.slice(1)] }),
      },
      {
        locked: lock.isOptionLocked("choices", "a"),
        kind: "option_deleted",
        edit: element({ choices: element().choices.slice(1) }),
      },
      {
        locked: lock.isAnswerCodeLocked("choices", "a"),
        kind: "answer_code_changed",
        edit: element({ choices: [choice("a", "Apple", "9"), ...element().choices.slice(1)] }),
      },
    ];
    for (const { locked, kind, edit } of cases) {
      expect(locked).toBe(true);
      expect(getPublishedLockViolations(stored, survey("inProgress", [edit])).map((v) => v.kind)).toContain(
        kind
      );
    }
  });
});
