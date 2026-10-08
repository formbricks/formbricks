import { describe, expect, test, vi } from "vitest";
import { QsfIdRegistry, findFreeSuffixedName, isObjectMemberName } from "./id-registry";

describe("QsfIdRegistry", () => {
  test("hands out the export tag when clean and free, case-insensitively", () => {
    const registry = new QsfIdRegistry();

    expect(registry.claim("Q1", "QID1")).toBe("Q1");
    expect(registry.claim("q1", "QID2")).toBe("QID2");
    expect(registry.has("Q1")).toBe(true);
  });

  test("cleans odd characters and falls back on reserved, seeded or empty tags", () => {
    const registry = new QsfIdRegistry(["utm_source"]);

    expect(registry.claim("Q 2 (final)", "QID2")).toBe("Q_2_final");
    expect(registry.claim("userId", "QID3")).toBe("QID3");
    // Reserved ids are refused in any casing, not only the one FORBIDDEN_IDS spells.
    expect(registry.claim("USERID", "QID4")).toBe("QID4");
    expect(registry.claim("", "QID5")).toBe("QID5");
    expect(registry.claim("UTM_SOURCE", "QID6")).toBe("QID6");
  });

  test.each(["constructor", "prototype", "toString", "HASOWNPROPERTY", "valueOf"])(
    "refuses the Object.prototype member name %s, which the id charset admits",
    (name) => {
      const registry = new QsfIdRegistry();

      expect(registry.claim(name, "QID7")).toBe("QID7");
    }
  );

  test("never hands out __proto__: cleaning trims its underscores", () => {
    expect(new QsfIdRegistry().claim("__proto__", "QID7")).toBe("proto");
  });

  test("suffixes the fallback when it is taken too", () => {
    const registry = new QsfIdRegistry();

    expect(registry.claim("QID1", "QID1")).toBe("QID1");
    expect(registry.claim("QID1", "QID1")).toBe("QID1_2");
    expect(registry.claim("QID1", "QID1")).toBe("QID1_3");
  });

  test("cuts a long tag to 64 characters", () => {
    expect(new QsfIdRegistry().claim("a".repeat(500), "QID1")).toBe("a".repeat(64));
  });

  test("cuts a fallback of the full length to fit each suffix, so it never runs out of ids", () => {
    const registry = new QsfIdRegistry();
    const fallback = "f".repeat(64);

    const ids = Array.from({ length: 12 }, () => registry.claim("", fallback));

    expect(ids.slice(0, 3)).toEqual([fallback, `${"f".repeat(62)}_2`, `${"f".repeat(62)}_3`]);
    expect(ids[11]).toBe(`${"f".repeat(61)}_12`);
    expect(new Set(ids).size).toBe(12);
    expect(ids.every((id) => id.length <= 64)).toBe(true);
  });
});

describe("findFreeSuffixedName", () => {
  test("fits every candidate to the length, however wide the counter grows", () => {
    const seen: string[] = [];

    const found = findFreeSuffixedName("s".repeat(64), {
      separator: "_x_",
      maxLength: 64,
      maxAttempts: 200,
      isFree: (candidate) => {
        seen.push(candidate);
        return seen.length === 150;
      },
    });

    expect(found).toBe(`${"s".repeat(58)}_x_151`);
    expect(seen.every((candidate) => candidate.length === 64)).toBe(true);
    expect(new Set(seen).size).toBe(seen.length);
  });

  test("gives up after its attempts instead of looping", () => {
    const isFree = vi.fn(() => false);

    expect(findFreeSuffixedName("id", { separator: "_", maxLength: 64, maxAttempts: 5, isFree })).toBeNull();
    expect(isFree).toHaveBeenCalledTimes(5);
  });
});

describe("isObjectMemberName", () => {
  test("matches every Object.prototype member and prototype, in any casing", () => {
    for (const name of Object.getOwnPropertyNames(Object.prototype)) {
      expect(isObjectMemberName(name.toUpperCase())).toBe(true);
    }
    expect(isObjectMemberName("Prototype")).toBe(true);
    expect(isObjectMemberName("customer_id")).toBe(false);
  });
});
