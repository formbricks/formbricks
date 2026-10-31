import { monitorEventLoopDelay } from "node:perf_hooks";
import { describe, expect, test, vi } from "vitest";
import { loadQsfFixture } from "./__fixtures__/load-fixture";
import { readQsf } from "./read-qsf";
import { sanitizeQsfTexts } from "./sanitize-text";

const yields = vi.hoisted(() => ({ count: 0 }));
vi.mock("node:timers/promises", async (importOriginal) => {
  const original = await importOriginal<typeof import("node:timers/promises")>();
  return {
    ...original,
    setImmediate: (...args: Parameters<typeof original.setImmediate>) => {
      yields.count += 1;
      return original.setImmediate(...args);
    },
  };
});

describe("sanitizeQsfTexts", () => {
  test("sanitizes every text in every language, with one report line per question and code", async () => {
    const survey = readQsf(loadQsfFixture("rich-text.qsf"));

    const result = await sanitizeQsfTexts(survey, new AbortController().signal);

    const qid1 = survey.questions.get("QID1");
    expect(result.byKey.get(qid1?.textKey ?? "")?.get("en-US")).toBe("<p>What is your <b>name</b>?</p>");
    expect(result.plainDefault.get(qid1?.textKey ?? "")).toBe("What is your name?");
    expect(result.issues).toEqual(
      expect.arrayContaining([
        { code: "image_dropped", severity: "warning", questionTag: "Q1", questionRef: "QID1" },
        { code: "script_dropped", severity: "warning", questionTag: "Q1", questionRef: "QID1" },
        { code: "script_dropped", severity: "warning", questionTag: "Q_hello", questionRef: "QID2" },
        { code: "markup_escaped", severity: "warning", questionTag: "Q3", questionRef: "QID3" },
        { code: "text_too_long", severity: "warning", questionTag: "Q6", questionRef: "QID6" },
        // The end message's image: about the ending, not a question.
        { code: "image_dropped", severity: "warning", params: { subject: "ending" } },
      ])
    );
    // Formatting is reported once for the whole survey.
    expect(result.issues.filter((issue) => issue.code === "formatting_dropped")).toEqual([
      { code: "formatting_dropped", severity: "info" },
    ]);
  });

  test("keeps every language of a text", async () => {
    const survey = readQsf(loadQsfFixture("multilang-en-de.qsf"));

    const result = await sanitizeQsfTexts(survey, new AbortController().signal);

    const qid1 = survey.questions.get("QID1");
    expect(Object.fromEntries(result.byKey.get(qid1?.textKey ?? "") ?? [])).toEqual({
      "en-US": "How satisfied are you?",
      "de-DE": "Wie zufrieden sind Sie?",
    });
  });

  test("stops when the import is aborted", async () => {
    const survey = readQsf(loadQsfFixture("large-150.qsf"));
    const controller = new AbortController();
    controller.abort();
    // Make every text costly enough that the loop has to yield, which is where it checks the signal.
    let costly = 0;
    for (const text of survey.texts.values()) {
      if (text.format === "rich" && costly++ < 5) {
        text.byLanguage.set(survey.defaultLanguage, "<span>x</span>".repeat(250));
      }
    }

    await expect(sanitizeQsfTexts(survey, controller.signal)).rejects.toThrow();
  });

  test(
    "yields to the event loop instead of holding it for a costly survey",
    { timeout: 30_000 },
    async () => {
      const survey = readQsf(loadQsfFixture("large-150.qsf"));
      // Every text of the survey, choices included, 60 tags long: about 600 small texts, over half a
      // second of sanitizing in all, which must not run as one block.
      for (const text of survey.texts.values()) {
        text.byLanguage.set(survey.defaultLanguage, "<span>x</span>".repeat(30));
      }
      const histogram = monitorEventLoopDelay({ resolution: 1 });

      // The histogram measures between ticks of its own timer, so it needs a tick before the work
      // starts and one after it, or a block at either end goes unrecorded.
      const tick = () => new Promise((resolve) => setTimeout(resolve, 20));
      histogram.enable();
      await tick();
      yields.count = 0;
      await sanitizeQsfTexts(survey, new AbortController().signal);
      await tick();
      histogram.disable();

      // Structural: over half a second of work in ~10 ms slices gives the event loop back dozens of
      // times; a sanitizer that stops yielding gives it back none.
      expect(yields.count).toBeGreaterThanOrEqual(20);
      // Coarse: each slice runs ~10 ms plus one small text; a loaded machine stretches it, so this only
      // catches the whole run held at once.
      expect(histogram.max / 1e6).toBeLessThan(1_000);
    }
  );
});
