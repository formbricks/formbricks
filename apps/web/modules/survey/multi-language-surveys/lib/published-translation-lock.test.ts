import { describe, expect, test } from "vitest";
import { TSurvey } from "@formbricks/types/surveys/types";
import { hasLockedTranslations, isTranslationPathLocked } from "./published-translation-lock";

const option = (id: string, label: Record<string, string>) => ({ id, label });

const surveyWith = (status: string, choices: ReturnType<typeof option>[]): TSurvey =>
  ({
    status,
    blocks: [
      {
        id: "b1",
        elements: [{ id: "q1", type: "multipleChoiceSingle", choices }],
      },
    ],
  }) as unknown as TSurvey;

const stored = (status = "inProgress") =>
  surveyWith(status, [option("a", { default: "Yes", de: "Ja" }), option("b", { default: "No", de: "" })]);

describe("isTranslationPathLocked", () => {
  const path = (index: number) => `blocks.0.elements.0.choices.${index}.label`;

  test("an option text the stored survey already has in that language is locked", () => {
    expect(isTranslationPathLocked(stored(), stored(), path(0), "de")).toBe(true);
  });

  test("an empty stored translation, an unknown language and a draft stay open", () => {
    expect(isTranslationPathLocked(stored(), stored(), path(1), "de")).toBe(false);
    expect(isTranslationPathLocked(stored(), stored(), path(0), "fr")).toBe(false);
    expect(isTranslationPathLocked(stored("draft"), stored("draft"), path(0), "de")).toBe(false);
  });

  test("an option added since the last save is not locked, and the lookup follows ids, not positions", () => {
    const local = surveyWith("inProgress", [
      option("new", { default: "Maybe" }),
      option("a", { default: "Yes", de: "Ja" }),
    ]);
    expect(isTranslationPathLocked(local, stored(), path(0), "de")).toBe(false);
    expect(isTranslationPathLocked(local, stored(), path(1), "de")).toBe(true);
  });

  test("a string that is not an option label is never locked", () => {
    expect(isTranslationPathLocked(stored(), stored(), "blocks.0.elements.0.headline", "de")).toBe(false);
  });
});

describe("hasLockedTranslations", () => {
  test("is true when a stored option has text in the language, or in any language when none is named", () => {
    expect(hasLockedTranslations(stored(), "de")).toBe(true);
    expect(hasLockedTranslations(stored())).toBe(true);
  });

  test("is false for another language, for a draft, and when the only translations are empty", () => {
    expect(hasLockedTranslations(stored(), "fr")).toBe(false);
    expect(hasLockedTranslations(stored("draft"), "de")).toBe(false);
    expect(hasLockedTranslations(surveyWith("inProgress", [option("a", { default: "Yes", de: " " })]))).toBe(
      false
    );
  });
});
