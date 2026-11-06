import { describe, expect, test } from "vitest";
import {
  EMBEDDED_FIELD_MEMBER_PATTERN,
  MAX_EMBEDDED_CHART_FIELDS,
  collectEmbeddedChartFields,
  getEmbeddedFieldMemberId,
  isEmbeddedFieldMember,
  toCubeEmbeddedFields,
  toStoredEmbeddedFieldName,
} from "./embedded-data-fields";

const decodeHex = (hex: string) =>
  new TextDecoder().decode(Uint8Array.from(hex.match(/../g) ?? [], (byte) => Number.parseInt(byte, 16)));

describe("getEmbeddedFieldMemberId", () => {
  test("is a stable, short Cube member for any name", () => {
    const id = getEmbeddedFieldMemberId("brand");
    expect(id).toMatch(EMBEDDED_FIELD_MEMBER_PATTERN);
    expect(getEmbeddedFieldMemberId("brand")).toBe(id);
    // Long and non-ASCII names stay well under Postgres' 63-character alias limit.
    expect(getEmbeddedFieldMemberId("ö".repeat(400))).toMatch(EMBEDDED_FIELD_MEMBER_PATTERN);
  });

  test("tells names apart, including case and inner whitespace", () => {
    const ids = new Set(["brand", "Brand", "br and", "brand2"].map(getEmbeddedFieldMemberId));
    expect(ids.size).toBe(4);
  });
});

describe("isEmbeddedFieldMember", () => {
  test("accepts only the generated member shape", () => {
    expect(isEmbeddedFieldMember(getEmbeddedFieldMemberId("plan"))).toBe(true);
    expect(isEmbeddedFieldMember("FeedbackRecords.metadataCountry")).toBe(false);
    expect(isEmbeddedFieldMember("FeedbackRecords.ed_123")).toBe(false);
    expect(isEmbeddedFieldMember("Other.ed_0123456789abcdef")).toBe(false);
  });
});

describe("toStoredEmbeddedFieldName", () => {
  test("mirrors the Feedback Record writer's key rules", () => {
    expect(toStoredEmbeddedFieldName(" brand ")).toBe("brand");
    expect(toStoredEmbeddedFieldName("br\u0000and")).toBe("brand");
    expect(toStoredEmbeddedFieldName("   ")).toBeNull();
    expect(toStoredEmbeddedFieldName("__proto__")).toBeNull();
    expect(toStoredEmbeddedFieldName(42)).toBeNull();
  });
});

describe("collectEmbeddedChartFields", () => {
  test("merges one name across surveys and lists the surveys", () => {
    const fields = collectEmbeddedChartFields([
      { name: "Onboarding", fields: [{ name: "brand", dataType: "string" }] },
      {
        name: "Checkout",
        fields: [
          { name: "brand", dataType: "string" },
          { name: "seats", dataType: "number" },
        ],
      },
    ]);

    expect(fields).toEqual([
      {
        id: getEmbeddedFieldMemberId("brand"),
        name: "brand",
        type: "string",
        surveyNames: ["Checkout", "Onboarding"],
      },
      { id: getEmbeddedFieldMemberId("seats"), name: "seats", type: "number", surveyNames: ["Checkout"] },
    ]);
  });

  test("keeps an agreed type and falls back to text when surveys disagree", () => {
    const fields = collectEmbeddedChartFields([
      {
        name: "A",
        fields: [
          { name: "trial", dataType: "boolean" },
          { name: "plan", dataType: "number" },
        ],
      },
      {
        name: "B",
        fields: [
          { name: "trial", dataType: "boolean" },
          { name: "plan", dataType: "string" },
        ],
      },
    ]);

    expect(Object.fromEntries(fields.map((field) => [field.name, field.type]))).toEqual({
      plan: "string",
      trial: "boolean",
    });
  });

  test("reads dates as text, since records store them as ISO strings", () => {
    const [field] = collectEmbeddedChartFields([
      { name: "A", fields: [{ name: "signup", dataType: "date" }] },
    ]);
    expect(field.type).toBe("string");
  });

  test("names records by their stored key: trimmed names merge, unpublishable ones are dropped", () => {
    const fields = collectEmbeddedChartFields([
      {
        name: "A",
        fields: [
          { name: " brand", dataType: "string" },
          { name: "brand ", dataType: "string" },
          { name: "", dataType: "string" },
          { name: "__proto__", dataType: "string" },
          { name: "x".repeat(513), dataType: "string" },
        ],
      },
    ]);
    expect(fields.map((field) => field.name)).toEqual(["brand"]);
  });

  test("returns nothing for a dataset without Embedded Data", () => {
    expect(collectEmbeddedChartFields([])).toEqual([]);
    expect(collectEmbeddedChartFields([{ name: "A", fields: [] }])).toEqual([]);
  });

  test("caps the list at what Cube accepts", () => {
    const many = Array.from({ length: MAX_EMBEDDED_CHART_FIELDS + 20 }, (_, index) => ({
      name: `field ${String(index).padStart(3, "0")}`,
      dataType: "string" as const,
    }));
    expect(collectEmbeddedChartFields([{ name: "A", fields: many }])).toHaveLength(MAX_EMBEDDED_CHART_FIELDS);
  });
});

describe("toCubeEmbeddedFields", () => {
  test("sends the bare member id and the name hex-encoded, never as text", () => {
    const name = `O'Brien $' \${x} — ünïcode`;
    const [field] = toCubeEmbeddedFields(
      collectEmbeddedChartFields([{ name: "A", fields: [{ name, dataType: "string" }] }])
    );

    expect(field.id).toBe(getEmbeddedFieldMemberId(name).slice("FeedbackRecords.".length));
    expect(field.hex).toMatch(/^[0-9a-f]+$/);
    expect(decodeHex(field.hex)).toBe(name);
    expect(field.type).toBe("string");
  });
});
