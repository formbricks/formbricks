import { describe, expect, test } from "vitest";
import { getCustomCssEditMode, getWorkspaceCssSaveStep } from "./edit-mode";

describe("getCustomCssEditMode", () => {
  test("role decides first, then the plan", () => {
    expect(getCustomCssEditMode({ canEdit: false, planAllowed: true })).toBe("read-only");
    expect(getCustomCssEditMode({ canEdit: false, planAllowed: false })).toBe("read-only");
    expect(getCustomCssEditMode({ canEdit: true, planAllowed: false })).toBe("clear-only");
    expect(getCustomCssEditMode({ canEdit: true, planAllowed: true })).toBe("full");
  });
});

describe("getWorkspaceCssSaveStep", () => {
  test("submits an edit with full access, including one whose check is still running", () => {
    expect(getWorkspaceCssSaveStep({ mode: "full", changeKind: "edit", status: "valid" })).toBe("submit");
    expect(getWorkspaceCssSaveStep({ mode: "full", changeKind: "edit", status: "pending" })).toBe("submit");
    expect(getWorkspaceCssSaveStep({ mode: "full", changeKind: "edit", status: "unavailable" })).toBe(
      "submit"
    );
  });

  test("stops the page's Save for a draft known to be invalid", () => {
    expect(getWorkspaceCssSaveStep({ mode: "full", changeKind: "edit", status: "invalid" })).toBe("block");
  });

  test("skips an unchanged draft and a read-only role, so the theme saves alone", () => {
    expect(getWorkspaceCssSaveStep({ mode: "full", changeKind: "unchanged", status: "invalid" })).toBe(
      "skip"
    );
    expect(getWorkspaceCssSaveStep({ mode: "read-only", changeKind: "removal", status: "empty" })).toBe(
      "skip"
    );
  });

  test("after a downgrade, saves a removal and nothing else", () => {
    expect(getWorkspaceCssSaveStep({ mode: "clear-only", changeKind: "removal", status: "empty" })).toBe(
      "submit"
    );
    expect(getWorkspaceCssSaveStep({ mode: "clear-only", changeKind: "edit", status: "valid" })).toBe("skip");
  });
});
