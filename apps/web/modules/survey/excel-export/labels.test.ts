import { describe, expect, test } from "vitest";
import { createIcuTranslate } from "./__fixtures__/translate";
import { createExcelExportLabels } from "./labels";

const labels = createExcelExportLabels([createIcuTranslate("de-DE"), createIcuTranslate("en-US")]);

describe("createExcelExportLabels", () => {
  test("reads a question type by its name in either language, or by its id, ignoring case and spaces", () => {
    expect(labels.elementType("Free text")).toBe("openText");
    expect(labels.elementType("  single-select ")).toBe("multipleChoiceSingle");
    expect(labels.elementType("Freitext")).toBe("openText");
    expect(labels.elementType("matrix")).toBe("matrix");
    expect(labels.elementType("Choice 1")).toBeNull();
  });

  test("reads a numbered field whatever its number, and a named field", () => {
    expect(labels.field("Choice 12")).toEqual({ kind: "choice" });
    expect(labels.field("row 3")).toEqual({ kind: "matrixRow" });
    expect(labels.field("Column 2")).toEqual({ kind: "matrixColumn" });
    expect(labels.field("Lower label")).toEqual({ kind: "property", property: "lowerLabel" });
    expect(labels.field("Subheader")).toEqual({ kind: "property", property: "subheader" });
    expect(labels.field("Choice")).toBeNull();
    expect(labels.field("")).toBeNull();
  });
});
