import { describe, expect, test } from "vitest";
import * as EditorModule from "./index";

describe("Editor Module Exports", () => {
  test("exports Editor component", () => {
    expect(EditorModule).toHaveProperty("Editor");
    expect(typeof EditorModule.Editor).toBe("function");
  });

  test("exports AddVariablesDropdown component", () => {
    expect(EditorModule).toHaveProperty("AddVariablesDropdown");
    expect(typeof EditorModule.AddVariablesDropdown).toBe("function");
  });
});
