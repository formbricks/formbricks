import { describe, expect, test } from "vitest";
import { QsfIdRegistry, isObjectMemberName } from "./id-registry";

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
