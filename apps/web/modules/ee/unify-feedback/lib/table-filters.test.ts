import { describe, expect, test } from "vitest";
import { appendHubQuery, toHubRecordQuery } from "./table-filters";

const now = new Date("2026-10-26T10:00:00Z");

describe("toHubRecordQuery", () => {
  test("maps quick filters onto repeatable Hub filters and the sort onto sort/order", () => {
    expect(
      toHubRecordQuery(
        [
          { property: "sourceType", operator: "in", values: ["survey", "review"] },
          { property: "sentiment", operator: "in", values: ["negative"] },
          { property: "emotion", operator: "in", values: ["anger"] },
        ],
        "importedAt",
        "UTC",
        now
      )
    ).toEqual({
      source_type: ["survey", "review"],
      sentiment: ["negative"],
      emotions: ["anger"],
      sort: "created_at",
      order: "asc",
    });
  });

  test("defaults to newest collected first", () => {
    expect(toHubRecordQuery([], "bogus", "UTC", now)).toEqual({ sort: "collected_at", order: "desc" });
  });

  test("resolves a collected-date preset in the reporting time zone", () => {
    const query = toHubRecordQuery(
      [{ property: "collectedAt", operator: "preset", values: ["last_7_days"] }],
      "-collectedAt",
      "UTC",
      now
    );
    expect(query?.since).toBe("2026-10-20T00:00:00.000Z");
    expect(query?.until).toBe("2026-10-26T23:59:59.999Z");
  });

  test("keeps the tightest of several bounds on one value", () => {
    const query = toHubRecordQuery(
      [
        { property: "valueNumber", operator: "greaterEqual", values: ["3"] },
        { property: "valueNumber", operator: "greaterEqual", values: ["8"] },
        { property: "valueNumber", operator: "lessEqual", values: ["10"] },
      ],
      "-collectedAt",
      "UTC",
      now
    );
    expect(query).toMatchObject({ value_number_min: "8", value_number_max: "10" });
  });

  test('an "is not" rule on a closed list becomes the other values', () => {
    expect(
      toHubRecordQuery(
        [{ property: "fieldType", operator: "notEquals", values: ["text"] }],
        "-collectedAt",
        "UTC",
        now
      )?.field_type
    ).toEqual(["categorical", "nps", "csat", "ces", "rating", "number", "boolean", "date"]);
  });

  test("filters that cannot match anything answer null instead of asking the Hub", () => {
    expect(
      toHubRecordQuery(
        [
          { property: "sentiment", operator: "equals", values: ["negative"] },
          { property: "sentiment", operator: "notEquals", values: ["negative"] },
        ],
        "-collectedAt",
        "UTC",
        now
      )
    ).toBeNull();
    expect(
      toHubRecordQuery(
        [
          { property: "valueNumber", operator: "greaterEqual", values: ["9"] },
          { property: "valueNumber", operator: "lessEqual", values: ["2"] },
        ],
        "-collectedAt",
        "UTC",
        now
      )
    ).toBeNull();
    expect(
      toHubRecordQuery(
        [
          { property: "collectedAt", operator: "isAfter", values: ["2026-10-10"] },
          { property: "collectedAt", operator: "isBefore", values: ["2026-10-01"] },
        ],
        "-collectedAt",
        "UTC",
        now
      )
    ).toBeNull();
  });
});

test("the Formbricks surveys source type asks for both stored spellings", () => {
  expect(
    toHubRecordQuery(
      [{ property: "sourceType", operator: "in", values: ["formbricks"] }],
      "-collectedAt",
      "UTC",
      now
    )?.source_type
  ).toEqual(["formbricks", "formbricks_survey"]);
});

describe("appendHubQuery", () => {
  test("repeats list filters and sets scalars", () => {
    const params = new URLSearchParams();
    appendHubQuery(params, { source_type: ["a", "b"], sort: "collected_at" });
    expect(params.toString()).toBe("source_type=a&source_type=b&sort=collected_at");
  });
});
