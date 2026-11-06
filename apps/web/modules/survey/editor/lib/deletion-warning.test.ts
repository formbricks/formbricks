import { describe, expect, test } from "vitest";
import en from "@/locales/en-US.json";
import { describeDeletionWarning } from "./deletion-warning";

/** A `t` backed by the real en-US strings, so a test reads what the editor shows. */
const t = ((key: string) => {
  const text = key.split(".").reduce<unknown>((node, part) => (node as Record<string, unknown>)?.[part], en);
  if (typeof text !== "string") throw new Error(`Missing en-US key ${key}`);
  return text;
}) as unknown as Parameters<typeof describeDeletionWarning>[1];

describe("describeDeletionWarning", () => {
  test("a question a rule uses keeps the logic title and text", () => {
    expect(describeDeletionWarning("logic", t)).toEqual({
      title: "Logic Inconsistency",
      body: "Elements from this block are used in a logic rule, are you sure you want to delete it?",
    });
  });

  test("a question a show-if uses names the show-if in the title, not logic", () => {
    expect(describeDeletionWarning("showIf", t)).toEqual({
      title: "Used in a show-if condition",
      body: "This question is used in a “shown only if” condition, are you sure you want to delete it?",
    });
  });

  test("a question whose options another question copies says so in the title", () => {
    expect(describeDeletionWarning("copiedOptions", t)).toEqual({
      title: "Options copied by another question",
      body: "Another question copies its options from this one. Are you sure you want to delete it?",
    });
  });

  test("without a known use it falls back to the logic warning", () => {
    expect(describeDeletionWarning(undefined, t).title).toBe("Logic Inconsistency");
  });
});
