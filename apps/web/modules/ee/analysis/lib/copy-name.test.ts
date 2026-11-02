import { describe, expect, test } from "vitest";
import { copyNamePrefix, nextCopyName } from "./copy-name";

const MAX = 255;

describe("nextCopyName", () => {
  test("takes the first free copy name", () => {
    expect(nextCopyName("NPS", [], MAX)).toBe("NPS (copy)");
    expect(nextCopyName("NPS", ["NPS (copy)"], MAX)).toBe("NPS (copy 2)");
    expect(nextCopyName("NPS", ["NPS (copy)", "NPS (copy 2)", "NPS (copy 4)"], MAX)).toBe("NPS (copy 3)");
  });

  test("names a copy of a copy after the original", () => {
    expect(nextCopyName("NPS (copy)", ["NPS (copy)"], MAX)).toBe("NPS (copy 2)");
    expect(nextCopyName("NPS (copy 7)", [], MAX)).toBe("NPS (copy)");
  });

  test("leaves a name that merely mentions a copy alone", () => {
    expect(nextCopyName("Copy (copyright)", [], MAX)).toBe("Copy (copyright) (copy)");
    expect(copyNamePrefix("NPS (copy 3)", MAX)).toBe("NPS (copy");
  });

  test("shortens a name too long for its suffix, so the copy stays within the limit", () => {
    const long = "a".repeat(MAX);
    const first = nextCopyName(long, [], MAX);
    expect(first).toBe(`${"a".repeat(MAX - 7)} (copy)`);
    expect(first).toHaveLength(MAX);

    const second = nextCopyName(long, [first], MAX);
    expect(second).toBe(`${"a".repeat(MAX - 9)} (copy 2)`);
    // A copy of the shortened copy is named after the same original.
    expect(nextCopyName(first, [first, second], MAX)).toBe(`${"a".repeat(MAX - 9)} (copy 3)`);
    // Every candidate starts with the lookup prefix, so the taken names are all found.
    for (const name of [first, second]) expect(name.startsWith(copyNamePrefix(long, MAX))).toBe(true);
  });

  test("never cuts through a surrogate pair", () => {
    const name = `${"a".repeat(MAX - 8)}😀😀`;
    const copy = nextCopyName(name, [], MAX);
    expect(copy.length).toBeLessThanOrEqual(MAX);
    expect(copy).toBe(`${"a".repeat(MAX - 8)} (copy)`);
    expect(copyNamePrefix(`${"a".repeat(MAX - 17)}😀`, MAX)).toBe("a".repeat(MAX - 17));
  });
});
