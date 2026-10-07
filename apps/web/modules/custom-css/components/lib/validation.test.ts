import { describe, expect, test } from "vitest";
import { type TCustomCssError, type TCustomCssWarning } from "@formbricks/types/custom-css";
import {
  type TCustomCssDraftCheck,
  type TCustomCssLastValid,
  canSaveCustomCssDraft,
  customCssKeys,
  deriveCustomCssValidationState,
  getCustomCssDraftKey,
  getNextLastValid,
  parseCustomCssDraftKey,
  parseCustomCssValidationData,
  toRendererCompiled,
} from "./validation";

const warning: TCustomCssWarning = {
  code: "import_removed",
  scope: "workspace",
  appearance: "light",
  line: 1,
  column: 1,
  reason: "@import is not allowed",
};

const syntaxError: TCustomCssError = {
  code: "syntax_error",
  scope: "workspace",
  appearance: "light",
  line: 2,
  column: 5,
  reason: "Unexpected token",
};

describe("parseCustomCssValidationData", () => {
  test("reads a valid result with compiled CSS and warnings", () => {
    expect(
      parseCustomCssValidationData(
        {
          valid: true,
          operation: "customCss",
          invalid_params: [],
          customCss: { light: "@layer fb-workspace{}", dark: null },
          warnings: [warning],
        },
        "workspace"
      )
    ).toEqual({ valid: true, compiled: { light: "@layer fb-workspace{}", dark: null }, warnings: [warning] });
  });

  test("reads an invalid result with located errors and no compiled CSS", () => {
    expect(
      parseCustomCssValidationData(
        {
          valid: false,
          operation: "customCss",
          invalid_params: [{ name: "x", reason: "y" }],
          errors: [syntaxError],
        },
        "workspace"
      )
    ).toEqual({ valid: false, errors: [syntaxError] });
  });

  test("falls back to invalid_params when an invalid result names no CSS errors", () => {
    const result = parseCustomCssValidationData(
      { valid: false, invalid_params: [{ name: "data.customCss", reason: "Too large" }] },
      "survey"
    );
    expect(result).toEqual({
      valid: false,
      errors: [expect.objectContaining({ code: "processing_failed", scope: "survey", reason: "Too large" })],
    });
  });

  test("treats a valid flag without usable compiled output as invalid, so nothing reaches the preview", () => {
    expect(parseCustomCssValidationData({ valid: true, customCss: { light: 1 } }, "workspace").valid).toBe(
      false
    );
    expect(parseCustomCssValidationData(null, "workspace").valid).toBe(false);
  });
});

describe("toRendererCompiled", () => {
  test("drops empty fields and returns null when nothing is left", () => {
    expect(toRendererCompiled({ light: "a", dark: null })).toEqual({ light: "a" });
    expect(toRendererCompiled({ light: null, dark: "" })).toBeNull();
    expect(toRendererCompiled(null)).toBeNull();
  });
});

describe("customCssKeys.validation", () => {
  test("differs for every draft content, so responses are cached per draft", () => {
    const base = { workspaceId: "ws", scope: "survey" as const, surveyId: "s1" };
    expect(customCssKeys.validation({ ...base, input: { light: "a", dark: null } })).not.toEqual(
      customCssKeys.validation({ ...base, input: { light: "b", dark: null } })
    );
    expect(customCssKeys.validation({ ...base, input: { light: "a", dark: null } })).not.toEqual(
      customCssKeys.validation({ ...base, input: { light: null, dark: "a" } })
    );
  });
});

describe("getCustomCssDraftKey", () => {
  test("cannot confuse a light-only and a dark-only draft", () => {
    expect(getCustomCssDraftKey({ light: "a", dark: null })).not.toBe(
      getCustomCssDraftKey({ light: null, dark: "a" })
    );
    expect(getCustomCssDraftKey(null)).toBe("");
  });

  test("round-trips through parseCustomCssDraftKey", () => {
    const input = { light: 'a { content: "]\\"" }', dark: null };
    expect(parseCustomCssDraftKey(getCustomCssDraftKey(input))).toEqual(input);
    expect(parseCustomCssDraftKey("")).toBeNull();
  });
});

const lastValid: TCustomCssLastValid = { key: "old", compiled: { light: "old-css" } };
const validCheck: TCustomCssDraftCheck = {
  kind: "settled",
  result: { valid: true, compiled: { light: "new-css", dark: null }, warnings: [warning] },
};
const invalidCheck: TCustomCssDraftCheck = {
  kind: "settled",
  result: { valid: false, errors: [syntaxError] },
};

describe("deriveCustomCssValidationState", () => {
  test("previews the current draft once its own result is valid", () => {
    expect(deriveCustomCssValidationState(validCheck, lastValid, "new")).toEqual({
      status: "valid",
      previewCss: { light: "new-css" },
      isPreviewBehind: false,
      warnings: [warning],
      errors: [],
    });
  });

  test("reuses the stored compiled object for the current draft, so the preview prop is stable", () => {
    const current: TCustomCssLastValid = { key: "new", compiled: { light: "new-css" } };
    expect(deriveCustomCssValidationState(validCheck, current, "new").previewCss).toBe(current.compiled);
  });

  test("keeps the last valid CSS on screen while the draft is invalid, and says so", () => {
    expect(deriveCustomCssValidationState(invalidCheck, lastValid, "new")).toEqual({
      status: "invalid",
      previewCss: { light: "old-css" },
      isPreviewBehind: true,
      warnings: [],
      errors: [syntaxError],
    });
  });

  test("keeps the last valid CSS while the draft is pending or could not be checked", () => {
    expect(deriveCustomCssValidationState({ kind: "pending" }, lastValid, "new")).toMatchObject({
      status: "pending",
      previewCss: { light: "old-css" },
      isPreviewBehind: true,
    });
    expect(deriveCustomCssValidationState({ kind: "request-failed" }, lastValid, "new")).toMatchObject({
      status: "unavailable",
      previewCss: { light: "old-css" },
    });
  });

  test("previews nothing for an empty draft", () => {
    expect(deriveCustomCssValidationState({ kind: "empty" }, lastValid, "")).toMatchObject({
      status: "empty",
      previewCss: null,
      isPreviewBehind: false,
    });
  });

  test("reports a local limit error as invalid without a request", () => {
    expect(
      deriveCustomCssValidationState({ kind: "local-error", errors: [syntaxError] }, null, "new")
    ).toMatchObject({ status: "invalid", previewCss: null, isPreviewBehind: false, errors: [syntaxError] });
  });
});

describe("getNextLastValid", () => {
  test("moves forward only on a valid result for the current draft", () => {
    expect(getNextLastValid(lastValid, validCheck, "new")).toEqual({
      key: "new",
      compiled: { light: "new-css" },
    });
    expect(getNextLastValid(lastValid, invalidCheck, "new")).toBe(lastValid);
    expect(getNextLastValid(lastValid, { kind: "pending" }, "new")).toBe(lastValid);
    expect(getNextLastValid(lastValid, { kind: "request-failed" }, "new")).toBe(lastValid);
  });

  test("an empty draft is a valid state that previews no CSS", () => {
    expect(getNextLastValid(lastValid, { kind: "empty" }, "")).toEqual({ key: "", compiled: null });
  });

  test("returns the same object when nothing changed, so state updates settle", () => {
    expect(getNextLastValid(lastValid, validCheck, "old")).toBe(lastValid);
  });
});

describe("canSaveCustomCssDraft", () => {
  test("blocks saving only an invalid or still-pending draft", () => {
    expect(canSaveCustomCssDraft("valid")).toBe(true);
    expect(canSaveCustomCssDraft("empty")).toBe(true);
    expect(canSaveCustomCssDraft("unavailable")).toBe(true);
    expect(canSaveCustomCssDraft("invalid")).toBe(false);
    expect(canSaveCustomCssDraft("pending")).toBe(false);
  });
});
