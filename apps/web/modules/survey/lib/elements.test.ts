import { TFunction } from "i18next";
import { SignatureIcon } from "lucide-react";
import { describe, expect, test } from "vitest";
import { TSurveyElementTypeEnum, ZSurveySignatureElement } from "@formbricks/types/surveys/elements";
import {
  TElementCategory,
  getCXElementTypes,
  getElementDefaults,
  getElementIcon,
  getElementIconMap,
  getElementNameMap,
  getElementTypes,
  getGroupedElementTypes,
  getTSurveyElementTypeEnumName,
  universalElementPresets,
} from "./elements";

const t = ((key: string) => key) as unknown as TFunction;

const defaultsFor = (type: TSurveyElementTypeEnum) =>
  getElementDefaults(type, {}, t) as Record<string, unknown>;

const signature = () => getElementTypes(t).find((type) => type.id === TSurveyElementTypeEnum.Signature);

describe("Signature in the element catalog", () => {
  test("is offered once, in the Input category next to File upload", () => {
    const entries = getElementTypes(t).filter((type) => type.id === TSurveyElementTypeEnum.Signature);
    expect(entries).toHaveLength(1);
    expect(entries[0].category).toBe(TElementCategory.Input);

    const ids = getElementTypes(t).map((type) => type.id);
    expect(ids.indexOf(TSurveyElementTypeEnum.Signature)).toBe(
      ids.indexOf(TSurveyElementTypeEnum.FileUpload) + 1
    );
  });

  test("is required and allows typed signatures by default, overriding the universal optional preset", () => {
    const preset = defaultsFor(TSurveyElementTypeEnum.Signature);
    expect(preset.required).toBe(true);
    expect(preset.allowTypedSignature).toBe(true);
    // The pickers spread the universal preset first and the element preset after it.
    expect({ ...universalElementPresets, ...preset }.required).toBe(true);
  });

  test("builds an element the survey schema accepts", () => {
    const element = {
      ...universalElementPresets,
      ...defaultsFor(TSurveyElementTypeEnum.Signature),
      id: "sig1",
      type: TSurveyElementTypeEnum.Signature,
      headline: { default: "Sign here" },
    };
    const parsed = ZSurveySignatureElement.safeParse(element);
    expect(parsed.success).toBe(true);
  });

  test("has a Lucide icon, a label and a description", () => {
    expect(signature()?.icon).toBe(SignatureIcon);
    expect(signature()?.label).toBe("templates.signature");
    expect(signature()?.description).toBe("templates.signature_description");
    expect(getElementIcon(TSurveyElementTypeEnum.Signature, t)).toBe(SignatureIcon);
    expect(getElementIconMap(t)[TSurveyElementTypeEnum.Signature]).toBeTruthy();
    expect(getElementNameMap(t)[TSurveyElementTypeEnum.Signature]).toBe("templates.signature");
    expect(getTSurveyElementTypeEnumName(TSurveyElementTypeEnum.Signature, t)).toBe("templates.signature");
  });

  test("shows in the grouped picker under Input", () => {
    const input = getGroupedElementTypes(t).find((group) => group.category.id === TElementCategory.Input);
    expect(input?.elements.map((element) => element.id)).toContain(TSurveyElementTypeEnum.Signature);
  });

  test("stays out of the CX-mode picker, like the other non-CX types", () => {
    expect(getCXElementTypes(t).map((type) => type.id)).not.toContain(TSurveyElementTypeEnum.Signature);
  });

  test("does not change File upload's preset", () => {
    const fileUpload = defaultsFor(TSurveyElementTypeEnum.FileUpload);
    expect(fileUpload.required).toBeUndefined();
    expect(fileUpload.allowTypedSignature).toBeUndefined();
  });
});
