import type { TFunction } from "i18next";
import { describe, expect, test } from "vitest";
import { getChipParts } from "./chip-label";
import type { TFilterProperty } from "./types";

const t = ((key: string, options?: { filter?: string }) =>
  options?.filter === undefined ? key : `${key}(${options.filter})`) as unknown as TFunction;

const status: TFilterProperty = {
  id: "status",
  label: "Status",
  valueType: "enum",
  options: [
    { value: "draft", label: "Draft" },
    { value: "inProgress", label: "In progress" },
  ],
};
const created: TFilterProperty = { id: "createdAt", label: "Created", valueType: "date" };
const seats: TFilterProperty = { id: "seats", label: "Seats", valueType: "number" };

describe("getChipParts", () => {
  test("a quick filter lists its values by their option labels", () => {
    const parts = getChipParts(
      { property: "status", operator: "in", values: ["draft", "inProgress"] },
      status,
      t,
      "en-US"
    );
    expect(parts).toEqual({
      label: "Status:",
      value: "Draft, In progress",
      accessibleName: "common.table_toolbar.chip_accessible_name(Status: Draft, In progress)",
    });
  });

  test("a value with no matching option shows as it is", () => {
    const parts = getChipParts(
      { property: "status", operator: "in", values: ["archived"] },
      status,
      t,
      "en-US"
    );
    expect(parts.value).toBe("archived");
  });

  test("a date preset shows its translated name", () => {
    const parts = getChipParts(
      { property: "createdAt", operator: "preset", values: ["last_7_days"] },
      created,
      t,
      "en-US"
    );
    expect(parts.label).toBe("Created:");
    expect(parts.value).toBe("workspace.analysis.charts.date_preset_last_7_days");
  });

  test("an unknown date preset shows the raw slug", () => {
    const parts = getChipParts(
      { property: "createdAt", operator: "preset", values: ["next_decade"] },
      created,
      t,
      "en-US"
    );
    expect(parts.value).toBe("next_decade");
  });

  test("a date range shows both calendar days in the given locale", () => {
    const parts = getChipParts(
      { property: "createdAt", operator: "between", values: ["2026-10-05", "2026-10-12"] },
      created,
      t,
      "en-US"
    );
    expect(parts.label).toBe("Created:");
    expect(parts.value).toBe("Oct 5, 2026 – Oct 12, 2026");
  });

  test("a rule reads property, operator and value", () => {
    const parts = getChipParts(
      { property: "seats", operator: "greaterThan", values: ["100"] },
      seats,
      t,
      "en-US"
    );
    expect(parts.label).toBe("Seats >");
    expect(parts.value).toBe("100");
    expect(parts.accessibleName).toBe("common.table_toolbar.chip_accessible_name(Seats > 100)");
  });

  test("an includes-any-of rule lists every value", () => {
    const parts = getChipParts(
      { property: "status", operator: "includesOneOf", values: ["draft", "inProgress"] },
      status,
      t,
      "en-US"
    );
    expect(parts.value).toBe("Draft, In progress");
  });

  test("a date rule formats its day", () => {
    const parts = getChipParts(
      { property: "createdAt", operator: "isBefore", values: ["2026-01-31"] },
      created,
      t,
      "en-US"
    );
    expect(parts.label).toBe("Created common.table_toolbar.operator_is_before");
    expect(parts.value).toBe("Jan 31, 2026");
  });

  test("a presence rule has no value pill, and its accessible name is the label alone", () => {
    const parts = getChipParts({ property: "seats", operator: "isSet", values: [] }, seats, t, "en-US");
    expect(parts.value).toBe("");
    expect(parts.accessibleName).toBe(
      "common.table_toolbar.chip_accessible_name(Seats common.table_toolbar.operator_is_set)"
    );
  });

  test("a value rule missing its value shows an empty pill", () => {
    const parts = getChipParts({ property: "seats", operator: "equals", values: [] }, seats, t, "en-US");
    expect(parts.value).toBe("");
  });
});
