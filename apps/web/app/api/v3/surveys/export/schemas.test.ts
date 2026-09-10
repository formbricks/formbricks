import { describe, expect, test } from "vitest";
import type { z } from "zod";
import { ZSurveyExportEnvelope, getSurveyExportFormat } from "./schemas";

/** Strict-object rejections carry the offending key in `keys`, not in `path`; flatten both. */
function issueLocations(error: z.ZodError): string[] {
  return error.issues.flatMap((issue) => {
    const base = issue.path.join(".");
    if (issue.code === "unrecognized_keys") {
      return issue.keys.map((key) => (base ? `${base}.${key}` : key));
    }
    return [base];
  });
}

const validEnvelope = {
  formbricks: {
    exportFormat: 1,
    exportedAt: "2026-09-08T12:00:00.000Z",
    appVersion: "6.2.0",
    source: {
      url: "https://app.formbricks.com",
      workspaceId: "clxx1234567890123456789012",
      surveyId: "clsv1234567890123456789012",
    },
  },
  survey: {
    name: "Product Feedback",
    type: "link",
    status: "inProgress",
    defaultLanguage: "en-US",
    languages: [{ code: "en-US", default: true, enabled: true }],
    blocks: [
      {
        id: "clbk1234567890123456789012",
        name: "Main",
        elements: [
          { id: "q1", type: "openText", headline: { "en-US": "What should we improve?" }, required: true },
        ],
      },
    ],
  },
  references: { actionClasses: [] },
};

describe("ZSurveyExportEnvelope", () => {
  test("parses a valid envelope into a typed v3 document", () => {
    const parsed = ZSurveyExportEnvelope.safeParse(validEnvelope);

    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.survey.type).toBe("link");
      expect(parsed.data.survey.blocks[0].elements[0].headline).toEqual({
        default: "What should we improve?",
      });
      expect(parsed.data.survey.endings).toEqual([]);
    }
  });

  test("rejects an extensions block with its path", () => {
    const parsed = ZSurveyExportEnvelope.safeParse({ ...validEnvelope, extensions: { styling: {} } });

    expect(parsed.success).toBe(false);
    if (!parsed.success) {
      expect(issueLocations(parsed.error)).toContain("extensions");
    }
  });

  test("rejects instance-bound fields inside the survey with a nested path", () => {
    const parsed = ZSurveyExportEnvelope.safeParse({
      ...validEnvelope,
      survey: { ...validEnvelope.survey, slug: "my-survey", workspaceId: "clxx1234567890123456789012" },
    });

    expect(parsed.success).toBe(false);
    if (!parsed.success) {
      const paths = issueLocations(parsed.error);
      expect(paths).toContain("survey.slug");
      expect(paths).toContain("survey.workspaceId");
    }
  });

  test("rejects a newer export format and exposes it through the probe", () => {
    const newer = { ...validEnvelope, formbricks: { ...validEnvelope.formbricks, exportFormat: 2 } };

    expect(ZSurveyExportEnvelope.safeParse(newer).success).toBe(false);
    expect(getSurveyExportFormat(newer)).toBe(2);
    expect(getSurveyExportFormat({ survey: {} })).toBeNull();
    expect(getSurveyExportFormat("nope")).toBeNull();
  });

  test("rejects unknown keys on action-class references and on the source", () => {
    const parsed = ZSurveyExportEnvelope.safeParse({
      ...validEnvelope,
      formbricks: { ...validEnvelope.formbricks, source: { ...validEnvelope.formbricks.source, extra: 1 } },
      references: {
        actionClasses: [
          {
            id: "claa1234567890123456789012",
            name: "Clicked",
            key: null,
            type: "noCode",
            noCodeConfig: { type: "pageView", urlFilters: [] },
            description: null,
            workspaceId: "clxx1234567890123456789012",
          },
        ],
      },
    });

    expect(parsed.success).toBe(false);
    if (!parsed.success) {
      const paths = issueLocations(parsed.error);
      expect(paths).toContain("formbricks.source.extra");
      expect(paths).toContain("references.actionClasses.0.workspaceId");
    }
  });
});
