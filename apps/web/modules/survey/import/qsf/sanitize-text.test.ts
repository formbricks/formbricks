import { monitorEventLoopDelay } from "node:perf_hooks";
import { describe, expect, test } from "vitest";
import { loadQsfFixture } from "./__fixtures__/load-fixture";
import { readQsf } from "./read-qsf";
import { containsMarkup, sanitizeQsfTexts, sanitizeText } from "./sanitize-text";

describe("sanitizeText", () => {
  describe("plain text", () => {
    test("keeps text and decodes entities", () => {
      expect(sanitizeText("Fish &amp; chips", "plain").text).toBe("Fish & chips");
      expect(sanitizeText("  a   b \n c ", "plain").text).toBe("a b c");
    });

    test("drops tags, keeping their text", () => {
      const result = sanitizeText('<span style="font-weight:bold">Bold</span> choice', "plain");

      expect(result.text).toBe("Bold choice");
      expect([...result.dropped]).toEqual(["formatting_dropped"]);
    });

    test("an escaped script stays text, and cannot render as markup once decoded", () => {
      // `textContent` decodes this into a live `<script>`; survey-ui's Label would render it as HTML.
      const result = sanitizeText("&lt;script&gt;alert(1)&lt;/script&gt;", "plain");

      expect(result.text).toBe("\uFF1Cscript>alert(1)\uFF1C/script>");
      expect(result.escaped).toBe(true);
      expect(containsMarkup(result.text)).toBe(false);
    });

    test("an escaped image with an onerror handler is neutralized the same way", () => {
      const result = sanitizeText("&lt;img src=x onerror=alert(1)&gt; typed", "plain");

      expect(result.text.startsWith("\uFF1Cimg")).toBe(true);
      expect(result.escaped).toBe(true);
    });

    test("leaves a less-than sign that is not markup alone", () => {
      const result = sanitizeText("a &lt; b", "plain");

      expect(result).toMatchObject({ text: "a < b", escaped: false });
    });

    test("reports images and scripts it removed", () => {
      const result = sanitizeText('Pick <img src="x" onerror="alert(1)"><script>bad()</script>', "plain");

      expect(result.text).toBe("Pick");
      expect([...result.dropped].sort()).toEqual(["image_dropped", "script_dropped"]);
    });
  });

  describe("rich text", () => {
    test("keeps the follow-up allowlist and reports what it removed", () => {
      const result = sanitizeText(
        '<p style="color:red">What is your <b>name</b>? <a href="javascript:alert(1)">x</a> <a href="https://example.com">terms</a></p><img src="https://cdn.example.com/a.png"><script>alert(1)</script>',
        "rich"
      );

      expect(result.text).toBe(
        '<p>What is your <b>name</b>? <a>x</a> <a href="https://example.com">terms</a></p>'
      );
      expect(result.plain).toBe("What is your name? x terms");
      expect([...result.dropped].sort()).toEqual(["formatting_dropped", "image_dropped", "script_dropped"]);
    });

    test("a leading script is seen and reported, not hidden in the document head", () => {
      const result = sanitizeText("<script>alert(1)</script><p>Hello</p>", "rich");

      expect(result.text).toBe("<p>Hello</p>");
      expect(result.dropped.has("script_dropped")).toBe(true);
    });

    test("stores text without markup decoded, so an entity does not show literally", () => {
      expect(sanitizeText("Fish &amp; chips", "rich").text).toBe("Fish & chips");
    });

    test("an escaped script is neutralized like plain text", () => {
      const result = sanitizeText("&lt;script&gt;alert(1)&lt;/script&gt;", "rich");

      expect(result.text).toBe("\uFF1Cscript>alert(1)\uFF1C/script>");
      expect(result.escaped).toBe(true);
    });
  });

  test.each([
    ["longer than 50,000 characters", "x".repeat(50_001)],
    ["with more than 500 tags", "<b>x</b>".repeat(251)],
  ])("refuses a text %s instead of parsing it", (_case, raw) => {
    expect(sanitizeText(raw, "rich")).toMatchObject({ text: "", tooLong: true });
  });
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
        { code: "image_dropped", severity: "warning", questionTag: "Q1" },
        { code: "script_dropped", severity: "warning", questionTag: "Q1" },
        { code: "script_dropped", severity: "warning", questionTag: "Q_hello" },
        { code: "markup_escaped", severity: "warning", questionTag: "Q3" },
        { code: "text_too_long", severity: "warning", questionTag: "Q6" },
        { code: "image_dropped", severity: "warning" },
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
      // Every headline 240 tags long (a few ms each on jsdom): over half a second of sanitizing in
      // all, which must not run as one block.
      for (const text of survey.texts.values()) {
        if (text.format === "rich") text.byLanguage.set(survey.defaultLanguage, "<span>x</span>".repeat(120));
      }
      const histogram = monitorEventLoopDelay({ resolution: 1 });

      // The histogram measures between ticks of its own timer, so it needs a tick before the work
      // starts and one after it, or a block at either end goes unrecorded.
      const tick = () => new Promise((resolve) => setTimeout(resolve, 20));
      histogram.enable();
      await tick();
      await sanitizeQsfTexts(survey, new AbortController().signal);
      await tick();
      histogram.disable();

      // Each slice runs ~10 ms plus one text; a loose bound that still fails if nothing yields.
      expect(histogram.max / 1e6).toBeLessThan(100);
    }
  );
});
