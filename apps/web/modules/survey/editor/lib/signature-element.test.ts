import { TFunction } from "i18next";
import { describe, expect, test } from "vitest";
import { TSurveyElementTypeEnum } from "@formbricks/types/surveys/elements";
import { isTypedSignatureAllowed, shouldWarnTypedSignatureOff } from "./signature-element";
import { getElementOperatorOptions } from "./utils";

describe("isTypedSignatureAllowed", () => {
  test("is on when the element never stored the setting (schema default)", () => {
    expect(isTypedSignatureAllowed({})).toBe(true);
  });

  test("follows the stored setting", () => {
    expect(isTypedSignatureAllowed({ allowTypedSignature: true })).toBe(true);
    expect(isTypedSignatureAllowed({ allowTypedSignature: false })).toBe(false);
  });
});

describe("shouldWarnTypedSignatureOff", () => {
  test("warns only when the question is required and typing is off", () => {
    expect(shouldWarnTypedSignatureOff({ required: true, allowTypedSignature: false })).toBe(true);
  });

  test("does not warn while typing is allowed", () => {
    expect(shouldWarnTypedSignatureOff({ required: true, allowTypedSignature: true })).toBe(false);
    expect(shouldWarnTypedSignatureOff({ required: true })).toBe(false);
  });

  test("does not warn on an optional question, which can be skipped", () => {
    expect(shouldWarnTypedSignatureOff({ required: false, allowTypedSignature: false })).toBe(false);
  });
});

describe("Signature logic operators in the editor", () => {
  const t = ((key: string) => key) as unknown as TFunction;
  const base = {
    id: "sig",
    type: TSurveyElementTypeEnum.Signature as const,
    headline: { default: "Sign" },
    allowTypedSignature: true,
  };

  test("an optional Signature offers is signed and is not signed", () => {
    const options = getElementOperatorOptions({ ...base, required: false }, t);
    expect(options.map((option) => [option.label, option.value])).toEqual([
      ["workspace.surveys.edit.is_signed", "isSubmitted"],
      ["workspace.surveys.edit.is_not_signed", "isSkipped"],
    ]);
  });

  test("a required Signature offers only is signed, as File upload does for isSkipped", () => {
    const options = getElementOperatorOptions({ ...base, required: true }, t);
    expect(options.map((option) => option.value)).toEqual(["isSubmitted"]);
  });
});
