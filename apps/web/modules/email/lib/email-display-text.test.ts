import { describe, expect, test } from "vitest";
import { MAX_EMAIL_DISPLAY_TEXT_LENGTH, toEmailDisplayText } from "./email-display-text";

const RIGHT_TO_LEFT_OVERRIDE = String.fromCodePoint(0x202e);
const ZERO_WIDTH_SPACE = String.fromCodePoint(0x200b);
const WORD_JOINER = String.fromCodePoint(0x2060);

describe("toEmailDisplayText", () => {
  test("keeps an ordinary name, including non-latin scripts, unchanged", () => {
    expect(toEmailDisplayText("Anna Müller", "Anonymous")).toBe("Anna Müller");
    expect(toEmailDisplayText("宋十八", "Anonymous")).toBe("宋十八");
  });

  test("removes links and email addresses", () => {
    expect(toEmailDisplayText("Win big https://spam.example/claim now", "Anonymous")).toBe("Win big now");
    expect(toEmailDisplayText("Visit www.spam.example today", "Anonymous")).toBe("Visit today");
    expect(toEmailDisplayText("Anna anna@spam.example", "Anonymous")).toBe("Anna");
  });

  // Mail clients turn a bare domain into a link just like a URL (ENG-3823).
  test("removes bare domains, with or without a path", () => {
    expect(toEmailDisplayText("Claim at spam.example now", "Anonymous")).toBe("Claim at now");
    expect(toEmailDisplayText("Go to win.spam.example/offer?x=1.", "Anonymous")).toBe("Go to");
    expect(toEmailDisplayText("spam.example", "Anonymous")).toBe("Anonymous");
  });

  test.each([
    "(spam.example)",
    "Anna,spam.example",
    "&spam.example",
    "'spam.example'",
    "x|spam.example/offer",
  ])("removes a bare domain wrapped in punctuation: %s", (token) => {
    expect(toEmailDisplayText(`Anna ${token}`, "Anonymous")).toBe("Anna");
  });

  test("keeps initials and ordinary punctuation", () => {
    expect(toEmailDisplayText("J.R.R. Tolkien", "Anonymous")).toBe("J.R.R. Tolkien");
    expect(toEmailDisplayText("Anna Müller, PhD.", "Anonymous")).toBe("Anna Müller, PhD.");
  });

  // An ordinary dotted name is not a host: only a delegated top-level domain makes a token a domain.
  test("keeps dotted names whose suffix is not a domain", () => {
    expect(toEmailDisplayText("john.doe", "Anonymous")).toBe("john.doe");
    expect(toEmailDisplayText("J.Smith", "Anonymous")).toBe("J.Smith");
    expect(toEmailDisplayText("Anna.Müller", "Anonymous")).toBe("Anna.Müller");
    expect(toEmailDisplayText("Dr.Smith", "Anonymous")).toBe("Dr.Smith");
  });

  // Reserved TLDs and delegated ones are both linkified by clients, so both go.
  test("removes real and reserved domains whatever the suffix", () => {
    expect(toEmailDisplayText("evil.com", "Anonymous")).toBe("Anonymous");
    expect(toEmailDisplayText("win.spam.co.uk", "Anonymous")).toBe("Anonymous");
    expect(toEmailDisplayText("foo.museum", "Anonymous")).toBe("Anonymous");
    expect(toEmailDisplayText("spam.test", "Anonymous")).toBe("Anonymous");
  });

  // `tldts` folds case for ASCII suffixes but not for a non-ASCII one, so the candidate is lower-cased first.
  test("removes a domain whose internationalized suffix is upper-cased", () => {
    expect(toEmailDisplayText("foo.РФ", "Anonymous")).toBe("Anonymous");
    expect(toEmailDisplayText("foo.рф", "Anonymous")).toBe("Anonymous");
  });

  test("checks long dotted names in linear time", () => {
    const started = performance.now();

    expect(Array.from(toEmailDisplayText(`${"a.".repeat(100_000)}x`, "Anonymous"))).toHaveLength(
      MAX_EMAIL_DISPLAY_TEXT_LENGTH
    );
    // A run of dots before the last letter is what a trailing-punctuation regex backtracks on.
    expect(Array.from(toEmailDisplayText(`${".".repeat(100_000)}a`, "Anonymous"))).toHaveLength(
      MAX_EMAIL_DISPLAY_TEXT_LENGTH
    );
    expect(performance.now() - started).toBeLessThan(1000);
  });

  test("removes links that hide an invisible character inside the scheme or host", () => {
    expect(toEmailDisplayText(`Win https:${WORD_JOINER}//spam.example now`, "Anonymous")).toBe("Win now");
    expect(toEmailDisplayText(`Visit www${WORD_JOINER}.spam.example today`, "Anonymous")).toBe("Visit today");
  });

  test("removes control and bidirectional override characters and collapses whitespace", () => {
    const name = `Anna${RIGHT_TO_LEFT_OVERRIDE}gnirps\n\tMüller${ZERO_WIDTH_SPACE}`;

    expect(toEmailDisplayText(name, "Anonymous")).toBe("Anna gnirps Müller");
  });

  test("falls back when nothing printable is left", () => {
    expect(toEmailDisplayText("https://spam.example", "Anonymous")).toBe("Anonymous");
    expect(toEmailDisplayText(`  ${RIGHT_TO_LEFT_OVERRIDE}  `, "Anonymous")).toBe("Anonymous");
    expect(toEmailDisplayText("", "")).toBe("");
  });

  test("caps the length by characters, not UTF-16 units", () => {
    const longName = "宋".repeat(MAX_EMAIL_DISPLAY_TEXT_LENGTH + 20);

    const result = toEmailDisplayText(longName, "Anonymous");

    expect(Array.from(result)).toHaveLength(MAX_EMAIL_DISPLAY_TEXT_LENGTH);
    expect(result.endsWith("…")).toBe(true);
  });

  test("handles very long names without separators in linear time", () => {
    const longRun = "a".repeat(200_000);

    expect(toEmailDisplayText(`${longRun}@${longRun}.com`, "Anonymous")).toBe("Anonymous");
    expect(Array.from(toEmailDisplayText(`${longRun}@${longRun}`, "Anonymous"))).toHaveLength(
      MAX_EMAIL_DISPLAY_TEXT_LENGTH
    );
  });

  test("does not touch a name exactly at the limit", () => {
    const name = "a".repeat(MAX_EMAIL_DISPLAY_TEXT_LENGTH);

    expect(toEmailDisplayText(name, "Anonymous")).toBe(name);
  });
});
