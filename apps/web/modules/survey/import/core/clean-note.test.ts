import { describe, expect, test } from "vitest";
import { cpuMsSince } from "./__fixtures__/cpu-time";
import { SURVEY_IMPORT_MAX_NOTE_CHARS, SURVEY_IMPORT_NOTE_URL_PATTERN, cleanNote } from "./clean-note";

describe("cleanNote", () => {
  test("replaces anything that looks like a link", () => {
    expect(cleanNote("Go to https://evil.example/a or www.evil.example, javascript:alert(1)")).toBe(
      "Go to … or … …"
    );
  });

  test.each([
    ["a domain with a path", "Log in at evil.com/login now", "Log in at … now"],
    ["an email address", "Write to user@evil.co today", "Write to … today"],
    ["a domain with a port", "Open evil.example:8080 first", "Open … first"],
    ["a bare domain with a common top-level domain", "See Mail.Evil-Example.org or evil.io.", "See … or …."],
    ["an English-word top-level domain with a path", "Go to evil.it/x or evil.me/a", "Go to … or …"],
    ["an English-word top-level domain after an @", "Mail user@evil.it", "Mail …"],
  ])("replaces %s", (_case, raw, cleaned) => {
    expect(cleanNote(raw)).toBe(cleaned);
  });

  test.each([
    "Shown only if 'Do you use it?' is 'Yes', e.g. for daily users (v2.0).",
    "Asked of Node.js users only.",
    "Skips to the next answer.Then ends the survey.",
    "If they selected.It then skips to the end.",
    "Shown to users.In Berlin only, answered.At least once, and asked.Me too.",
    "Skips if chosen.Is shown to.Us and skips.To the end.",
  ])("leaves prose alone: %s", (note) => {
    expect(cleanNote(note)).toBe(note);
  });

  test("drops control characters, bidi overrides and markup characters", () => {
    expect(cleanNote("a\u0007b\u202ec<script>")).toBe("a b cscript");
  });

  test("still catches a host with more labels than a match holds", () => {
    expect(cleanNote("Go to a.b.c.d.e.f.g.h.i.j.k.l.evil.com/x first")).toBe("Go to a.b.c.… first");
  });

  test.each(["a.", "ab.", "a-", `${"a".repeat(63)}.`, "a@", "1."])(
    "scans a long run of %j for links in linear time",
    (unit) => {
      // 20,000 characters: a quadratic scan of a dotted run took seconds here, a linear one milliseconds.
      const run = unit.repeat(Math.ceil(20_000 / unit.length));
      const startedAt = process.cpuUsage();

      run.replaceAll(SURVEY_IMPORT_NOTE_URL_PATTERN, "…");

      expect(cpuMsSince(startedAt)).toBeLessThan(250);
    }
  );

  test("caps the length", () => {
    const note = cleanNote("x".repeat(5_000));

    expect(note).toHaveLength(SURVEY_IMPORT_MAX_NOTE_CHARS);
    expect(note.endsWith("…")).toBe(true);
  });
});
