import DOMPurify from "isomorphic-dompurify";
import { monitorEventLoopDelay } from "node:perf_hooks";
import { describe, expect, test, vi } from "vitest";
import { cpuMsSince } from "./__fixtures__/cpu-time";
import { loadQsfFixture } from "./__fixtures__/load-fixture";
import { readQsf } from "./read-qsf";
import { containsMarkup, sanitizeQsfTexts, sanitizeText } from "./sanitize-text";

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

/**
 * The nodes DOMPurify visits while `work` runs: zero when nothing was parsed. Counted through a hook on
 * the default export, removed by reference so no other hook is touched.
 */
const nodesParsed = (work: () => void): number => {
  let nodes = 0;
  const count = () => {
    nodes += 1;
  };
  DOMPurify.addHook("beforeSanitizeElements", count);
  try {
    work();
  } finally {
    DOMPurify.removeHook("beforeSanitizeElements", count);
  }
  return nodes;
};

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

  describe("tags written as character references", () => {
    // Decoded by `textContent`, each `&lt;i>` is an `<i>` the plain-text re-parse nests: 4,000 of them
    // held the event loop for about 2 s, and 8,333 (the 50,000-character cap) threw a `RangeError`.
    test.each([
      ["&lt;i>", 4_000],
      ["&lt;i>", 8_333],
      ["&#60;i>", 501],
      ["&#x3C;i>", 501],
      ["&#0060i>", 501],
      ["&#x003cI>", 501],
      ["&LT;i>", 501],
      ["&lt;i>", 501],
    ])("refuses %s repeated %i times without parsing it", (tag, times) => {
      const start = process.cpuUsage();

      const parsed = nodesParsed(() => {
        for (const format of ["plain", "rich"] as const) {
          expect(sanitizeText(tag.repeat(times), format)).toMatchObject({ text: "", tooLong: true });
        }
      });

      // Structural: refused on the count, before any parse.
      expect(parsed).toBe(0);
      // Coarse: a count over at most 50,000 characters, well under a millisecond each.
      expect(cpuMsSince(start)).toBeLessThan(50);
    });

    test("keeps a text whose raw and encoded tags together stay within the cap", () => {
      const result = sanitizeText(`${"<b>x</b>".repeat(100)}${"&lt;i>".repeat(299)}`, "plain");

      expect(result).toMatchObject({ tooLong: false, escaped: true });
    });
  });
});

describe("containsMarkup", () => {
  test("reads a text with more `<` than a text may hold tags as markup, without parsing it", () => {
    // What a decode `sanitizeText` did not count would hand the re-parse.
    const start = process.cpuUsage();

    expect(nodesParsed(() => expect(containsMarkup("<i>".repeat(8_333))).toBe(true))).toBe(0);
    expect(cpuMsSince(start)).toBeLessThan(50);
  });

  test("still parses a text within the cap", () => {
    expect(nodesParsed(() => expect(containsMarkup("<i>".repeat(500))).toBe(true))).toBeGreaterThan(0);
    expect(containsMarkup("a < b, ".repeat(400))).toBe(false);
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
        { code: "image_dropped", severity: "warning", questionTag: "Q1", questionRef: "QID1" },
        { code: "script_dropped", severity: "warning", questionTag: "Q1", questionRef: "QID1" },
        { code: "script_dropped", severity: "warning", questionTag: "Q_hello", questionRef: "QID2" },
        { code: "markup_escaped", severity: "warning", questionTag: "Q3", questionRef: "QID3" },
        { code: "text_too_long", severity: "warning", questionTag: "Q6", questionRef: "QID6" },
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
