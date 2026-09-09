import { describe, expect, test } from "vitest";
import type { TSurveyImportStreamEvent } from "@/app/api/internal/surveys/import/lib/events";
import {
  INITIAL_IMPORT_PROGRESS,
  formatLanguageCodes,
  getImportProgressSteps,
  reduceImportProgress,
} from "./import-progress";

const run = (events: (TSurveyImportStreamEvent | { type: string })[]) =>
  events.reduce(reduceImportProgress, INITIAL_IMPORT_PROGRESS);

const doneEvent = (languages: string[], detected?: string[]): TSurveyImportStreamEvent => ({
  type: "done",
  payload: null,
  document: null,
  references: null,
  validation: { valid: true, invalid_params: [] },
  report: {
    source: {
      lane: "ai",
      kind: "docx",
      ...(detected ? { detectedLanguages: detected.map((code) => ({ code, confidence: 0.9 })) } : {}),
    },
    summary: {
      blocks: 1,
      elements: 3,
      endings: 1,
      languages,
      logicRules: 0,
      logicRulesReported: 0,
      hiddenFields: 0,
    },
    issues: [],
  },
});

describe("reduceImportProgress", () => {
  test("follows the server's stages: steps are done/current/pending from events, not time", () => {
    let state = run([{ type: "start", requestId: "r", source: { lane: "ai", kind: "docx" } }]);
    expect(getImportProgressSteps(state).map((step) => step.status)).toEqual([
      "pending",
      "pending",
      "pending",
      "pending",
    ]);

    state = reduceImportProgress(state, { type: "progress", stage: "reading" });
    expect(getImportProgressSteps(state).map((step) => step.status)).toEqual([
      "current",
      "pending",
      "pending",
      "pending",
    ]);

    state = reduceImportProgress(state, {
      type: "progress",
      stage: "extracting",
      chunk: { index: 2, total: 5 },
    });
    const steps = getImportProgressSteps(state);
    expect(steps.map((step) => step.status)).toEqual(["done", "done", "current", "pending"]);
    expect(steps[2].chunk).toEqual({ index: 2, total: 5 });

    state = reduceImportProgress(state, doneEvent(["en-US"]));
    expect(getImportProgressSteps(state).map((step) => step.status)).toEqual([
      "done",
      "done",
      "done",
      "done",
    ]);
    expect(state.finished).toBe(true);
  });

  test("a deterministic lane jumps from reading to validating and marks the skipped steps done", () => {
    const state = run([
      { type: "start", requestId: "r", source: { lane: "structured", kind: "qsf" } },
      { type: "progress", stage: "reading" },
      { type: "progress", stage: "validating" },
    ]);
    expect(getImportProgressSteps(state).map((step) => step.status)).toEqual([
      "done",
      "done",
      "done",
      "current",
    ]);
  });

  test("language codes accumulate from partial drafts and the final report", () => {
    let state = run([
      { type: "start", requestId: "r", source: { lane: "ai", kind: "docx" } },
      {
        type: "partial",
        seq: 1,
        blockOffset: 0,
        draft: {
          name: [
            { languageCode: "en-US", text: "A" },
            { languageCode: "de-DE", text: "B" },
          ],
        },
      },
    ]);
    expect(state.languageCodes).toEqual(["en-US", "de-DE"]);
    const unchanged = reduceImportProgress(state, {
      type: "partial",
      seq: 2,
      blockOffset: 0,
      draft: { name: [{ languageCode: "de-DE", text: "B" }] },
    });
    expect(unchanged).toBe(state);

    state = reduceImportProgress(state, doneEvent(["en-US", "de-DE", "fr-FR"], ["en-US"]));
    expect(state.languageCodes).toEqual(["en-US", "de-DE", "fr-FR"]);
    expect(getImportProgressSteps(state)[1].languageCodes).toEqual(["en-US", "de-DE", "fr-FR"]);
    expect(formatLanguageCodes(state.languageCodes)).toBe("EN · DE · FR");
  });

  test("unknown events and errors leave the state alone; a new start resets it", () => {
    const state = run([
      { type: "start", requestId: "r", source: { lane: "ai", kind: "pdf" } },
      { type: "progress", stage: "extracting", chunk: { index: 1, total: 2 } },
    ]);
    expect(reduceImportProgress(state, { type: "future" })).toBe(state);
    expect(reduceImportProgress(state, { type: "error", code: "ai_generation_failed", detail: "x" })).toBe(
      state
    );
    expect(
      reduceImportProgress(state, { type: "start", requestId: "r2", source: { lane: "ai", kind: "docx" } })
    ).toEqual({
      ...INITIAL_IMPORT_PROGRESS,
      source: { lane: "ai", kind: "docx" },
    });
  });
});
