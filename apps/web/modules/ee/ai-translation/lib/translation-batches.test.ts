import { describe, expect, test } from "vitest";
import {
  AI_TRANSLATION_FIELDS_PER_BATCH,
  AI_TRANSLATION_SOURCE_CHARS_PER_BATCH,
  createTranslationActionBatches,
  createTranslationBatches,
} from "./translation-batches";

const field = (index: number, length: number) => ({
  path: `questions.${index}.headline.default`,
  defaultText: "x".repeat(length),
  isRichText: false,
});

describe("createTranslationBatches", () => {
  test("splits a 228-field survey while preserving every field in order", () => {
    const fields = Array.from({ length: 228 }, (_, index) => field(index, 100));
    const batches = createTranslationBatches(fields);

    expect(batches.flat()).toEqual(fields);
    expect(batches).toHaveLength(29);
    expect(batches.every((batch) => batch.length <= AI_TRANSLATION_FIELDS_PER_BATCH)).toBe(true);
  });

  test("keeps each request within the source text budget", () => {
    const fields = [field(0, 1800), field(1, 1300), field(2, 200), field(3, 1600)];
    const batches = createTranslationBatches(fields);

    expect(batches.map((batch) => batch.map(({ path }) => path))).toEqual([
      [fields[0].path],
      [fields[1].path, fields[2].path],
      [fields[3].path],
    ]);
    expect(
      batches.every(
        (batch) =>
          batch.reduce((length, entry) => length + entry.defaultText.length, 0) <=
          AI_TRANSLATION_SOURCE_CHARS_PER_BATCH
      )
    ).toBe(true);
  });

  test("keeps an oversized field in its own batch", () => {
    const fields = [field(0, AI_TRANSLATION_SOURCE_CHARS_PER_BATCH + 1), field(1, 10)];

    expect(createTranslationBatches(fields)).toEqual([[fields[0]], [fields[1]]]);
  });

  test("does not make a request for an empty field list", () => {
    expect(createTranslationBatches([])).toEqual([]);
  });

  test("groups at most three model batches into each action", () => {
    const fields = Array.from({ length: 228 }, (_, index) => field(index, 100));
    const actionBatches = createTranslationActionBatches(fields);

    expect(actionBatches.flat()).toEqual(fields);
    expect(actionBatches).toHaveLength(10);
    expect(actionBatches.map((batch) => batch.length)).toEqual([24, 24, 24, 24, 24, 24, 24, 24, 24, 12]);
  });
});
