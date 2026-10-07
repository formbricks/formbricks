import { describe, expect, test } from "vitest";
import { canSubmitCustomCssDraft, getCustomCssEditMode } from "./edit-mode";

describe("getCustomCssEditMode", () => {
  test("role decides first, then the plan", () => {
    expect(getCustomCssEditMode({ canEdit: false, planAllowed: true })).toBe("read-only");
    expect(getCustomCssEditMode({ canEdit: false, planAllowed: false })).toBe("read-only");
    expect(getCustomCssEditMode({ canEdit: true, planAllowed: false })).toBe("clear-only");
    expect(getCustomCssEditMode({ canEdit: true, planAllowed: true })).toBe("full");
  });
});

describe("canSubmitCustomCssDraft", () => {
  test("submits a valid edit with full access", () => {
    expect(canSubmitCustomCssDraft({ mode: "full", changeKind: "edit", status: "valid" })).toBe(true);
  });

  test("never submits an unchanged draft or from read-only", () => {
    expect(canSubmitCustomCssDraft({ mode: "full", changeKind: "unchanged", status: "valid" })).toBe(false);
    expect(canSubmitCustomCssDraft({ mode: "read-only", changeKind: "removal", status: "empty" })).toBe(
      false
    );
  });

  test("after a downgrade, allows clearing but not adding or editing", () => {
    expect(canSubmitCustomCssDraft({ mode: "clear-only", changeKind: "removal", status: "empty" })).toBe(
      true
    );
    expect(canSubmitCustomCssDraft({ mode: "clear-only", changeKind: "removal", status: "valid" })).toBe(
      true
    );
    expect(canSubmitCustomCssDraft({ mode: "clear-only", changeKind: "edit", status: "valid" })).toBe(false);
  });

  test("waits for an invalid or pending draft", () => {
    expect(canSubmitCustomCssDraft({ mode: "full", changeKind: "edit", status: "invalid" })).toBe(false);
    expect(canSubmitCustomCssDraft({ mode: "full", changeKind: "edit", status: "pending" })).toBe(false);
  });
});
