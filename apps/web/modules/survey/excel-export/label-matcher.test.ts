import { describe, expect, test } from "vitest";
import { createLabelMatcher } from "./label-matcher";

/** What the matcher must answer, the slow way: each label tried at each position. */
const bruteForce = (labels: readonly string[], text: string): number[] =>
  Array.from({ length: text.length }, (_, start) =>
    Math.max(
      0,
      ...labels.filter((label) => label && text.startsWith(label, start)).map((label) => label.length)
    )
  );

/** A small deterministic generator, so a failure replays. */
const random = (seed: number) => () => {
  seed = (seed * 1_103_515_245 + 12_345) % 2_147_483_648;
  return seed / 2_147_483_648;
};

describe("createLabelMatcher", () => {
  test("gives the longest label starting at each position", () => {
    const longest = createLabelMatcher(["@Name", "@Name of company", "@Age"])(
      "Hi @Name of company, @Age @Nam"
    );
    expect([...longest].map((length, start) => [start, length]).filter(([, length]) => length > 0)).toEqual([
      [3, 16],
      [21, 4],
    ]);
  });

  test("finds a label inside another label's text, and labels that are suffixes of others", () => {
    const labels = ["@a@b", "@b", "@x@a", "@a"];
    const text = "@x@a@b and @a@b@b";
    expect([...createLabelMatcher(labels)(text)]).toEqual(bruteForce(labels, text));
  });

  test("agrees with trying every label at every position, on random labels and texts", () => {
    const next = random(6809);
    const word = (length: number) => Array.from({ length }, () => "@ab"[Math.floor(next() * 3)]).join("");
    for (let round = 0; round < 200; round += 1) {
      const labels = Array.from(
        { length: 1 + Math.floor(next() * 6) },
        () => `@${word(Math.floor(next() * 4))}`
      );
      const text = word(40);
      expect([...createLabelMatcher(labels)(text)]).toEqual(bruteForce(labels, text));
    }
  });

  test("matches labels with characters outside the Basic Multilingual Plane", () => {
    const labels = ["@🙂 Name", "@🙂", "@名前"];
    const text = "Hi @🙂 Name, @🙂! @名前 @🙃";
    expect([...createLabelMatcher(labels)(text)]).toEqual(bruteForce(labels, text));
  });

  test("ignores an empty label, and matches nothing with none", () => {
    expect([...createLabelMatcher(["", "@a"])("@a")]).toEqual([2, 0]);
    expect([...createLabelMatcher([])("@a")]).toEqual([0, 0]);
  });

  test("reads a full cell against many labels sharing a long prefix in linear time", () => {
    // Every position starts a near-match of every label: what makes a per-label search quadratic.
    const labels = Array.from({ length: 64 }, (_, index) => `${"@".repeat(500)}${index}`);
    const text = "@".repeat(32_767);
    const started = performance.now();
    createLabelMatcher(labels)(text);
    expect(performance.now() - started).toBeLessThan(1_000);
  });
});
