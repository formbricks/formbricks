import { describe, expect, test } from "vitest";
import { exampleTheme } from "./example-theme";

describe("exampleTheme", () => {
  test("contains all required theme properties", () => {
    expect(exampleTheme).toHaveProperty("rtl");
    expect(exampleTheme).toHaveProperty("ltr");
    expect(exampleTheme).toHaveProperty("placeholder");
    expect(exampleTheme).toHaveProperty("paragraph");
  });

  test("contains heading styles", () => {
    expect(exampleTheme).toHaveProperty("heading");
    expect(exampleTheme.heading).toHaveProperty("h1");
    expect(exampleTheme.heading).toHaveProperty("h2");
    expect(exampleTheme.heading.h1).toBe("fb-editor-heading-h1");
    expect(exampleTheme.heading.h2).toBe("fb-editor-heading-h2");
  });

  test("contains list styles", () => {
    expect(exampleTheme).toHaveProperty("list");
    expect(exampleTheme.list).toHaveProperty("nested");
    expect(exampleTheme.list).toHaveProperty("ol");
    expect(exampleTheme.list).toHaveProperty("ul");
    expect(exampleTheme.list).toHaveProperty("listitem");
    expect(exampleTheme.list.nested).toHaveProperty("listitem");
  });

  test("contains text formatting styles", () => {
    expect(exampleTheme).toHaveProperty("text");
    expect(exampleTheme.text).toHaveProperty("bold");
    expect(exampleTheme.text).toHaveProperty("italic");
    expect(exampleTheme.text.bold).toBe("fb-editor-text-bold");
    expect(exampleTheme.text.italic).toBe("fb-editor-text-italic");
  });

  test("contains link style", () => {
    expect(exampleTheme).toHaveProperty("link");
    expect(exampleTheme.link).toBe("fb-editor-link");
  });

  test("contains image style", () => {
    expect(exampleTheme).toHaveProperty("image");
    expect(exampleTheme.image).toBe("fb-editor-image");
  });

  test("contains directional styles", () => {
    expect(exampleTheme.rtl).toBe("fb-editor-rtl");
    expect(exampleTheme.ltr).toBe("fb-editor-ltr");
  });

  test("uses fb-editor prefix for all classes", () => {
    const themeFlatMap = {
      ...exampleTheme,
      ...exampleTheme.heading,
      ...exampleTheme.list,
      ...exampleTheme.list.nested,
      ...exampleTheme.text,
    };

    Object.values(themeFlatMap).forEach((value) => {
      if (typeof value === "string") {
        expect(value).toMatch(/^fb-editor-/);
      }
    });
  });
});
