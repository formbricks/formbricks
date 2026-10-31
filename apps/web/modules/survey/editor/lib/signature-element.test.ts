import { TFunction } from "i18next";
import { describe, expect, test } from "vitest";
import { TSurveyElementTypeEnum } from "@formbricks/types/surveys/elements";
import {
  isTypedSignatureAllowed,
  shouldShowNotSignedLogicHint,
  shouldWarnTypedSignatureOff,
} from "./signature-element";
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

describe("shouldShowNotSignedLogicHint", () => {
  test("explains the missing is not signed condition on a required Signature only", () => {
    expect(shouldShowNotSignedLogicHint({ required: true })).toBe(true);
    expect(shouldShowNotSignedLogicHint({ required: false })).toBe(false);
    expect(shouldShowNotSignedLogicHint({})).toBe(false);
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

  const labelled = (options: { label: string; value: string | number }[]) =>
    options.map((option) => [option.label, option.value]);

  test("an optional Signature offers is signed and is not signed", () => {
    const options = getElementOperatorOptions({ ...base, required: false }, t);
    expect(labelled(options)).toEqual([
      ["workspace.surveys.edit.is_signed", "isSubmitted"],
      ["workspace.surveys.edit.is_not_signed", "isSkipped"],
    ]);
  });

  test("a required Signature offers only is signed, as File upload does for isSkipped", () => {
    const options = getElementOperatorOptions({ ...base, required: true }, t);
    expect(labelled(options)).toEqual([["workspace.surveys.edit.is_signed", "isSubmitted"]]);
  });

  test("File upload keeps its submitted / skipped words, with or without Required", () => {
    const fileUpload = {
      id: "file",
      type: TSurveyElementTypeEnum.FileUpload as const,
      headline: { default: "Upload" },
      allowMultipleFiles: false,
    };
    expect(labelled(getElementOperatorOptions({ ...fileUpload, required: false } as never, t))).toEqual([
      ["workspace.surveys.edit.is_submitted", "isSubmitted"],
      ["workspace.surveys.edit.is_skipped", "isSkipped"],
    ]);
    expect(labelled(getElementOperatorOptions({ ...fileUpload, required: true } as never, t))).toEqual([
      ["workspace.surveys.edit.is_submitted", "isSubmitted"],
    ]);
  });
});
