import { describe, expect, test } from "vitest";
import { toAttributeListParams } from "./table-filters";

describe("toAttributeListParams", () => {
  test("maps data type and type filters, search and sort", () => {
    expect(
      toAttributeListParams(
        [
          { property: "dataType", operator: "in", values: ["number", "date"] },
          { property: "type", operator: "equals", values: ["custom"] },
        ],
        " plan ",
        "-updatedAt"
      )
    ).toEqual([
      ["filter[dataType][in]", "number"],
      ["filter[dataType][in]", "date"],
      ["filter[type][in]", "custom"],
      ["search", "plan"],
      ["sortBy", "-updatedAt"],
    ]);
  });

  test("every value of a property is no filter; an unknown sort falls back to name", () => {
    expect(
      toAttributeListParams([{ property: "type", operator: "in", values: ["custom", "default"] }], "", "x")
    ).toEqual([["sortBy", "name"]]);
  });

  test("is null when the filters exclude every value", () => {
    expect(
      toAttributeListParams(
        [
          { property: "type", operator: "equals", values: ["custom"] },
          { property: "type", operator: "notEquals", values: ["custom"] },
        ],
        "",
        "name"
      )
    ).toBeNull();
  });
});
