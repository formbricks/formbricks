import { mockSurvey } from "@/app/api/(internal)/pipeline/lib/__mocks__/survey-follow-up.mock";
import { describe, expect, test } from "vitest";
import { ZSurvey } from "@formbricks/types/surveys/types";

/**
 * ENG-1834: new declared field names must satisfy `isSafeIdentifier`, but the survey schemas on the
 * load path stay lenient. These names are already stored in production databases, so `ZSurvey` has
 * to keep parsing them or those surveys stop loading entirely.
 *
 * This test lives in apps/web rather than packages/types because packages/types cannot import from
 * apps/web, and the complete `TSurvey` fixtures live here.
 */
describe("legacy declared field names still load", () => {
  const legacySurvey = {
    ...mockSurvey,
    // `surveyRefinement` validates a follow-up's `to` against the elements it derives from
    // `survey.blocks`, and this fixture still uses the legacy `questions` array with `blocks: []`,
    // so its follow-ups fail an unrelated refinement. Dropped to isolate the naming rules.
    followUps: [],
    hiddenFields: {
      enabled: true,
      fieldIds: ["Legacy-Field_1", "UserID", "safe_field"],
    },
    variables: [
      { id: "hqfvw2b1x0dpsnmqrxjhqz1m", name: "_legacy", type: "text" as const, value: "" },
      { id: "kzqfhrxg2n1cvdpb8t0mws4y", name: "score", type: "number" as const, value: 0 },
    ],
  };

  test("a survey with legacy caps/hyphen hidden fields and a legacy variable name parses", () => {
    const result = ZSurvey.safeParse(legacySurvey);

    expect(result.error).toBeUndefined();
    expect(result.success).toBe(true);
  });

  test("legacy names are preserved byte-for-byte", () => {
    const result = ZSurvey.safeParse(legacySurvey);

    expect(result.success).toBe(true);
    if (!result.success) return;

    expect(result.data.hiddenFields.fieldIds).toEqual(["Legacy-Field_1", "UserID", "safe_field"]);
    expect(result.data.variables.map((variable) => variable.name)).toEqual(["_legacy", "score"]);
  });

  test("names the shared rule has never allowed are still rejected", () => {
    const spacedFieldId = ZSurvey.safeParse({
      ...legacySurvey,
      hiddenFields: { enabled: true, fieldIds: ["has spaces"] },
    });
    expect(spacedFieldId.success).toBe(false);
    // Asserted on the issue path so an unrelated refinement regression cannot keep this green.
    expect(spacedFieldId.error?.issues.map((issue) => issue.path.join("."))).toContain(
      "hiddenFields.fieldIds.0"
    );

    const uppercaseVariable = ZSurvey.safeParse({
      ...legacySurvey,
      variables: [{ id: "hqfvw2b1x0dpsnmqrxjhqz1m", name: "Legacy", type: "text" as const, value: "" }],
    });
    expect(uppercaseVariable.success).toBe(false);
    expect(uppercaseVariable.error?.issues.map((issue) => issue.path.join("."))).toContain(
      "variables.0.variables"
    );
  });
});
