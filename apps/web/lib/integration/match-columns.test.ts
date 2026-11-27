import { describe, expect, test } from "vitest";
import { TColumnChoice, matchLabelsToColumns } from "./match-columns";

const existing = (column: number): TColumnChoice => ({ existing: column });
const create = (name: string): TColumnChoice => ({ create: name });

/**
 * Writes the labels the way both integrations do: existing columns keep their names, new ones are appended.
 * Returns the columns after the write and the column each label went to.
 */
const write = (columns: string[], labels: string[], legacyLabels: string[]) => {
  const next = [...columns];
  const placed = matchLabelsToColumns(columns, labels, legacyLabels).map((choice) => {
    if ("existing" in choice) return choice.existing;
    next.push(choice.create);
    return next.length - 1;
  });
  return { columns: next, placed };
};

// ENG-3682: "A B" is a two-paragraph headline's label after the fix, "AB" its legacy label.
describe("matchLabelsToColumns", () => {
  test("matches a label to the column with the same name", () => {
    expect(matchLabelsToColumns(["Created At", "A B"], ["A B"], ["AB"])).toEqual([existing(1)]);
  });

  test("falls back to the column with the legacy label", () => {
    expect(matchLabelsToColumns(["Created At", "AB"], ["A B"], ["AB"])).toEqual([existing(1)]);
  });

  test("prefers the new label when both columns exist", () => {
    expect(matchLabelsToColumns(["AB", "A B"], ["A B"], ["AB"])).toEqual([existing(1)]);
  });

  test("creates a column with the new label when neither exists", () => {
    expect(matchLabelsToColumns(["Created At"], ["A B"], ["AB"])).toEqual([create("A B")]);
  });

  test("matches a repeated unchanged label by occurrence, and repeats its name for a further one", () => {
    expect(
      matchLabelsToColumns(["Name", "Name"], ["Name", "Name", "Name"], ["Name", "Name", "Name"])
    ).toEqual([existing(0), existing(1), create("Name")]);
  });

  test("matches a repeated changed label to its legacy columns by occurrence", () => {
    expect(matchLabelsToColumns(["AB", "AB"], ["A B", "A B"], ["AB", "AB"])).toEqual([
      existing(0),
      existing(1),
    ]);
  });

  describe("when a changed label equals another question's label", () => {
    // q1 is `<p>A</p><p>B</p>` (now "A B", legacy "AB"); q2 is a plain "A B" headline.
    const labels = ["A B", "A B"];
    const legacyLabels = ["AB", "A B"];

    test("leaves the plain question its column and sends the changed one to its legacy column", () => {
      expect(matchLabelsToColumns(["AB", "A B"], labels, legacyLabels)).toEqual([existing(0), existing(1)]);
    });

    test("creates a column for each, the changed one under its legacy label", () => {
      expect(matchLabelsToColumns([], labels, legacyLabels)).toEqual([create("AB"), create("A B")]);
    });

    test("keeps each question in its column across writes", () => {
      const first = write([], labels, legacyLabels);
      const second = write(first.columns, labels, legacyLabels);
      expect(second).toEqual(first);
    });
  });

  describe("when two changed labels coincide but their legacy labels differ", () => {
    // `<p>A</p><p>BC</p>` and `<p>AB</p><p>C</p>` both read "A B C" now.
    const labels = ["A B C", "A B C"];
    const legacyLabels = ["A BC", "AB C"];

    test("gives each its legacy column, and creates a missing one under its legacy label", () => {
      expect(matchLabelsToColumns(["A BC"], labels, legacyLabels)).toEqual([existing(0), create("AB C")]);
    });

    test("never uses a column named by the shared new label", () => {
      expect(matchLabelsToColumns(["A B C", "A BC", "AB C"], labels, legacyLabels)).toEqual([
        existing(1),
        existing(2),
      ]);
    });

    test("keeps each question in its column across writes", () => {
      const first = write(["A BC"], labels, legacyLabels);
      const second = write(first.columns, labels, legacyLabels);
      expect(second).toEqual(first);
    });
  });

  describe("when a changed label's new name is another changed label's legacy name", () => {
    // q1 read "A BCD" before the fix and "A BC D" now; q2 reads "A BCD" now and read "ABCD" before.
    const labels = ["A BC D", "A BCD"];
    const legacyLabels = ["A BCD", "ABCD"];

    test("gives the name to the question it was the legacy label of", () => {
      expect(matchLabelsToColumns(["A BCD"], labels, legacyLabels)).toEqual([existing(0), create("ABCD")]);
    });

    test("keeps each question in its column across writes, in either order", () => {
      const first = write(["A BCD"], labels, legacyLabels);
      expect(write(first.columns, labels, legacyLabels)).toEqual(first);

      const reversed = write([], [...labels].reverse(), [...legacyLabels].reverse());
      expect(write(reversed.columns, [...labels].reverse(), [...legacyLabels].reverse())).toEqual(reversed);
    });
  });

  test("gives three headlines whose names chain into each other their own legacy fields", () => {
    // `<p>AB</p><p>C</p>` ("AB C", was "ABC"), `<p>A</p><p>B C</p>` ("A B C", was "AB C"), plain "A B C".
    const labels = ["AB C", "A B C", "A B C"];
    const legacyLabels = ["ABC", "AB C", "A B C"];
    expect(matchLabelsToColumns([], labels, legacyLabels)).toEqual([
      create("ABC"),
      create("AB C"),
      create("A B C"),
    ]);
    expect(matchLabelsToColumns(["ABC", "AB C", "A BC"], labels, ["ABC", "AB C", "A BC"])).toEqual([
      existing(0),
      existing(1),
      existing(2),
    ]);
  });

  test("keeps the pre-fix order when two headlines read alike before the fix", () => {
    // q1 is `<p>A</p><p>B</p>` (legacy "AB"); q2 is a plain "AB" headline. Both wrote to "AB" columns
    // before the fix, the first occurrence to the first column.
    expect(matchLabelsToColumns(["AB"], ["A B", "AB"], ["AB", "AB"])).toEqual([existing(0), create("AB")]);
  });

  test("keeps a repeated changed label's occurrences in their columns across writes", () => {
    // A sheet from before the fix has one "AB" column; a second "<p>A</p><p>B</p>" question was added.
    const first = write(["AB"], ["A B", "A B"], ["AB", "AB"]);
    expect(first).toEqual({ columns: ["AB", "A B"], placed: [0, 1] });
    expect(write(first.columns, ["A B", "A B"], ["AB", "AB"])).toEqual(first);
  });
});

/**
 * Properties over random surveys: headlines built from blocks, the legacy label gluing the blocks and the
 * new one spacing them. A block may hold a space itself (`<p>A B</p>`), so one headline's legacy label
 * can read like another's new label. Seeded, so a failure reproduces.
 */
describe("matchLabelsToColumns properties", () => {
  const blocks = ["A", "B", "C", "AB", "BC", "A B", "B C"];

  const randomSurveys = (count: number) => {
    let seed = 7;
    const random = (n: number) => {
      seed = Math.trunc(seed + 0x6d2b79f5);
      let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) % n;
    };
    return Array.from({ length: count }, () => {
      const headlines = Array.from({ length: 1 + random(4) }, () =>
        Array.from({ length: 1 + random(3) }, () => blocks[random(blocks.length)])
      );
      return {
        labels: headlines.map((parts) => parts.join(" ")),
        legacyLabels: headlines.map((parts) => parts.join("")),
        before: random(headlines.length + 1),
      };
    });
  };
  const surveys = randomSurveys(3000);

  test("Google Sheets: every question gets its own column and keeps it on the next write", () => {
    for (const { labels, legacyLabels } of surveys) {
      for (const start of [[], legacyLabels]) {
        const first = write(start, labels, legacyLabels);
        expect(new Set(first.placed).size).toBe(labels.length);
        expect(write(first.columns, labels, legacyLabels)).toEqual(first);
      }
    }
  });

  test("Google Sheets: a sheet from before the fix keeps every question in its column", () => {
    for (const { labels, legacyLabels, before } of surveys) {
      // The first `before` questions existed before the fix, which wrote one column per legacy label.
      const { placed } = write(legacyLabels.slice(0, before), labels, legacyLabels);
      expect(placed.slice(0, before)).toEqual(labels.slice(0, before).map((_, index) => index));
    }
  });

  test("Airtable: only questions that shared a field before the fix share one, and names are stable", () => {
    const fieldNames = (fields: string[], labels: string[], legacyLabels: string[]) =>
      matchLabelsToColumns(fields, labels, legacyLabels).map((choice) =>
        "existing" in choice ? fields[choice.existing] : choice.create
      );
    for (const { labels, legacyLabels } of surveys) {
      for (const start of [[], [...new Set(legacyLabels)]]) {
        const names = fieldNames(start, labels, legacyLabels);
        names.forEach((name, i) =>
          names.forEach((other, j) => {
            if (name === other) expect(legacyLabels[i]).toBe(legacyLabels[j]);
          })
        );
        const fields = [...new Set([...start, ...names])];
        expect(fieldNames(fields, labels, legacyLabels)).toEqual(names);
      }
    }
  });
});
