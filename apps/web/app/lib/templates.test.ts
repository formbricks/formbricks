import type { TFunction } from "i18next";
import { describe, expect, test } from "vitest";
import { TSurveyElementTypeEnum } from "@formbricks/types/surveys/elements";
import { XM_TEMPLATE_IDS } from "@/app/(app)/(onboarding)/organizations/[organizationId]/workspaces/new/templates/lib/xm-template-ids";
import { templates } from "./templates";

const mockT = ((key: string): string => key) as unknown as TFunction;

describe("templates", () => {
  test("includes all XM onboarding templates in the main catalog", () => {
    const catalog = templates(mockT);

    expect(
      XM_TEMPLATE_IDS.map((templateId) => catalog.find((template) => template.id === templateId)?.id)
    ).toEqual([...XM_TEMPLATE_IDS]);
  });

  test("keeps XM templates simple and free of branch logic", () => {
    const catalog = templates(mockT);
    const xmTemplateIds = new Set<string>(XM_TEMPLATE_IDS);
    const xmTemplates = catalog.filter((template) => xmTemplateIds.has(template.id));

    expect(xmTemplates.map((template) => template.id)).toEqual([...XM_TEMPLATE_IDS]);

    for (const template of xmTemplates) {
      expect(template.preset.blocks.length).toBeGreaterThanOrEqual(2);
      expect(template.preset.blocks.every((block) => !block.logic?.length)).toBe(true);
      expect(template.preset.blocks[0].elements).toHaveLength(1);
    }

    expect(xmTemplates.map((template) => template.preset.blocks[0].elements[0].type)).toEqual([
      TSurveyElementTypeEnum.NPS,
      TSurveyElementTypeEnum.Rating,
      TSurveyElementTypeEnum.CSAT,
      TSurveyElementTypeEnum.CES,
      TSurveyElementTypeEnum.CSAT,
      TSurveyElementTypeEnum.NPS,
    ]);
  });
});
