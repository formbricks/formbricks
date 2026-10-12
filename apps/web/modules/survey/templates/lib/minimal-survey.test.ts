import type { TFunction } from "i18next";
import { describe, expect, test } from "vitest";
import { getSurveyEmbeddedFields } from "@formbricks/types/embedded-data-resolver";
import { getDefaultSurveyPreset } from "@/app/lib/survey-builder";
import { getTemplatePreviewSurvey } from "./minimal-survey";

const t = ((key: string) => key) as unknown as TFunction;

describe("getTemplatePreviewSurvey", () => {
  /**
   * A preset has never been written, so no rows exist for it, and every reader — the preview's
   * recall and logic included — reads rows only (ENG-2404). Without the adapter at this boundary a
   * template that declares fields would preview as if it declared none.
   */
  test("gives a preset's legacy declarations to the readers as embeddedFields, variables first", () => {
    const preset = {
      ...getDefaultSurveyPreset(t),
      variables: [{ id: "clx000000000000000000001", name: "score", type: "number" as const, value: 0 }],
      hiddenFields: { enabled: true, fieldIds: ["plan"] },
    };

    const survey = getTemplatePreviewSurvey(t, preset);

    expect(
      getSurveyEmbeddedFields(survey).map(({ field, link }) => [field.source, link.storageKey])
    ).toStrictEqual([
      ["computed", "clx000000000000000000001"],
      ["ingested", "plan"],
    ]);
    expect(survey.name).toBe(preset.name);
  });

  test("a preset that declares nothing previews with an empty list, not an absent one", () => {
    expect(getTemplatePreviewSurvey(t, getDefaultSurveyPreset(t)).embeddedFields).toStrictEqual([]);
  });
});
