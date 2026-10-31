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
  test("is offered once, in the Input category", () => {
    const entries = getElementTypes(t).filter((type) => type.id === TSurveyElementTypeEnum.Signature);
    expect(entries).toHaveLength(1);
    expect(entries[0].category).toBe(TElementCategory.Input);
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

  test("is not plan-gated: the catalog has no plan input, and every plan gets the same entry", () => {
    // `getElementTypes` takes only `t`, so a free-plan workspace and an enterprise one see one catalog.
    expect(getElementTypes.length).toBe(1);
    expect(signature()).toBeDefined();
    // The preset builds from an empty workspace, which is all a free-plan context adds.
    expect(getElementDefaults(TSurveyElementTypeEnum.Signature, {}, t)).toMatchObject({ required: true });
  });

  test("does not change File upload's preset", () => {
    const fileUpload = defaultsFor(TSurveyElementTypeEnum.FileUpload);
    expect(fileUpload.required).toBeUndefined();
    expect(fileUpload.allowTypedSignature).toBeUndefined();
  });
});
