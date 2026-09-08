import { describe, expect, test } from "vitest";
import { QsfIdRegistry } from "./id-registry";

describe("QsfIdRegistry", () => {
  test("hands out the export tag when clean and free, case-insensitively", () => {
    const registry = new QsfIdRegistry();
    expect(registry.claim("Q1", "QID1")).toBe("Q1");
    expect(registry.claim("q1", "QID2")).toBe("QID2");
    expect(registry.has("Q1")).toBe(true);
  });

  test("sanitizes odd characters and falls back on forbidden or empty tags", () => {
    const registry = new QsfIdRegistry(["utm_source"]);
    expect(registry.claim("Q 2 (final)", "QID2")).toBe("Q_2_final");
    expect(registry.claim("userId", "QID3")).toBe("QID3");
    expect(registry.claim("", "QID4")).toBe("QID4");
    expect(registry.claim("utm_source", "QID5")).toBe("QID5");
  });

  test("suffixes the fallback when it is taken too", () => {
    const registry = new QsfIdRegistry();
    expect(registry.claim("QID1", "QID1")).toBe("QID1");
    expect(registry.claim("QID1", "QID1")).toBe("QID1_2");
    expect(registry.claim("QID1", "QID1")).toBe("QID1_3");
  });
});
