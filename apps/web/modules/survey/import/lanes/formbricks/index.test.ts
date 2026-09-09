import { describe, expect, test } from "vitest";
import {
  FIXTURE_APP_SURVEY,
  FIXTURE_LINK_SURVEY,
  FIXTURE_WORKSPACE_ID,
} from "@/modules/survey/export/__fixtures__/surveys";
import { buildSurveyExportEnvelope } from "@/modules/survey/export/build-export-envelope";
import type { TImportContext, TImportLaneInput } from "../../types";
import { formbricksLane } from "./index";

const ctx: TImportContext = {
  workspaceId: FIXTURE_WORKSPACE_ID,
  organizationId: "org_1",
  userId: "user_1",
  requestId: "req_1",
  importRunId: "run_1",
};

function envelopeOf(survey: typeof FIXTURE_LINK_SURVEY) {
  const result = buildSurveyExportEnvelope(survey, {
    appVersion: "6.2.0",
    publicUrl: "https://app.formbricks.com",
    exportedAt: new Date("2026-09-08T12:00:00.000Z"),
  });
  if (!result.ok) throw new Error(JSON.stringify(result.error));
  return result.data;
}

const asBytes = (value: unknown, fileName = "survey.formbricks.json"): TImportLaneInput => ({
  kind: "formbricks-export",
  fileName,
  content: { type: "bytes", bytes: Buffer.from(JSON.stringify(value)) },
});

/** A hand-written raw v3 document, as the MCP `create_survey` tool documents it. */
const mcpDocument = {
  name: "Onboarding feedback",
  type: "link",
  defaultLanguage: "en-US",
  blocks: [
    {
      name: "Main",
      elements: [{ id: "why", type: "openText", headline: { "en-US": "Why did you stop?" }, required: true }],
    },
  ],
};

describe("formbricksLane", () => {
  test("reads an export envelope: document, references, source kind, no instance fields", async () => {
    const envelope = envelopeOf(FIXTURE_APP_SURVEY);

    const candidate = await formbricksLane(asBytes(envelope, "in-app.formbricks.json"), ctx);

    expect(candidate.source).toEqual({
      lane: "lossless",
      kind: "formbricks-export",
      fileName: "in-app.formbricks.json",
    });
    expect(candidate.issues).toEqual([]);
    expect(candidate.references?.actionClasses).toHaveLength(2);
    expect(candidate.document).toEqual(envelope.survey);
    expect(candidate.document).not.toHaveProperty("workspaceId");
  });

  test("accepts a raw v3 document from a GET response body, stripping id, workspaceId and timestamps", async () => {
    const envelope = envelopeOf(FIXTURE_LINK_SURVEY);
    const getResponse = {
      data: {
        id: "clsv1234567890123456789012",
        workspaceId: FIXTURE_WORKSPACE_ID,
        createdAt: "2026-09-01T10:00:00.000Z",
        updatedAt: "2026-09-01T10:00:00.000Z",
        archivedAt: null,
        ...envelope.survey,
      },
    };

    const candidate = await formbricksLane(
      { kind: "v3-document", fileName: "response.json", content: { type: "json", value: getResponse } },
      ctx
    );

    expect(candidate.source.kind).toBe("v3-document");
    expect(candidate.references).toBeUndefined();
    expect(candidate.document).toEqual(envelope.survey);
    expect(candidate.issues).toEqual([]);
  });

  test("accepts a hand-written document from the MCP tool docs, as text with a BOM", async () => {
    const candidate = await formbricksLane(
      { kind: "v3-document", content: { type: "text", text: `\uFEFF${JSON.stringify(mcpDocument)}` } },
      ctx
    );

    expect(candidate.document).toEqual(mcpDocument);
    expect(candidate.source).toEqual({ lane: "lossless", kind: "v3-document" });
  });

  test("reports slug and schedule from a hand-edited file and removes them", async () => {
    const candidate = await formbricksLane(
      {
        kind: "v3-document",
        content: {
          type: "json",
          value: { ...mcpDocument, slug: "my-link", publishOn: "2026-10-01T00:00:00.000Z", createdBy: "u1" },
        },
      },
      ctx
    );

    expect(candidate.document).toEqual(mcpDocument);
    expect(candidate.issues.map((issue) => issue.code)).toEqual(["slug_not_imported", "schedule_cleared"]);
    expect(candidate.issues.every((issue) => issue.severity === "info")).toBe(true);
  });

  test("leaves an extensions block for the report and passes references through", async () => {
    const envelope = envelopeOf(FIXTURE_LINK_SURVEY);

    const candidate = await formbricksLane(
      asBytes({ ...envelope, extensions: { styling: { brandColor: "#000" } } }),
      ctx
    );

    expect(candidate.document).toEqual(envelope.survey);
    expect(candidate.issues).toEqual([
      expect.objectContaining({ severity: "info", code: "unknown_field_stripped", path: "extensions" }),
    ]);
  });

  test("refuses a newer export format", async () => {
    const envelope = envelopeOf(FIXTURE_LINK_SURVEY);

    const candidate = await formbricksLane(
      asBytes({ ...envelope, formbricks: { ...envelope.formbricks, exportFormat: 2 } }),
      ctx
    );

    expect(candidate.document).toBeNull();
    expect(candidate.issues).toEqual([
      expect.objectContaining({
        severity: "error",
        code: "export_format_unsupported",
        path: "formbricks.exportFormat",
        message: expect.stringContaining("export format 2"),
      }),
    ]);
  });

  test("refuses legacy question-based documents", async () => {
    const candidate = await formbricksLane(
      {
        kind: "v3-document",
        content: {
          type: "json",
          value: { name: "Old", blocks: [], questions: [{ id: "q1", type: "openText" }] },
        },
      },
      ctx
    );

    expect(candidate.document).toBeNull();
    expect(candidate.issues).toEqual([
      expect.objectContaining({ severity: "error", code: "legacy_questions_unsupported", path: "questions" }),
    ]);
  });

  test("refuses broken JSON, non-objects and envelopes with invalid metadata or references", async () => {
    const broken = await formbricksLane(
      { kind: "formbricks-export", content: { type: "text", text: "{ nope" } },
      ctx
    );
    expect(broken.document).toBeNull();
    expect(broken.issues[0]).toMatchObject({ severity: "error", code: "invalid_document" });

    const array = await formbricksLane(
      { kind: "v3-document", content: { type: "json", value: [1, 2, 3] } },
      ctx
    );
    expect(array.issues[0]).toMatchObject({ code: "invalid_document" });

    const envelope = envelopeOf(FIXTURE_LINK_SURVEY);
    const badMetadata = await formbricksLane(
      asBytes({ ...envelope, formbricks: { exportFormat: 1, exportedAt: "yesterday" } }),
      ctx
    );
    expect(badMetadata.document).toBeNull();
    expect(badMetadata.issues.every((issue) => issue.code === "invalid_document")).toBe(true);
    expect(badMetadata.issues[0].path?.startsWith("formbricks")).toBe(true);

    const badReferences = await formbricksLane(
      asBytes({ ...envelope, references: { actionClasses: [{ id: "x" }] } }),
      ctx
    );
    expect(badReferences.document).toBeNull();
    expect(badReferences.issues[0].path?.startsWith("references")).toBe(true);

    const noSurvey = await formbricksLane(
      asBytes({ formbricks: envelope.formbricks, references: { actionClasses: [] } }),
      ctx
    );
    expect(noSurvey.issues[0]).toMatchObject({ code: "invalid_document", path: "survey" });
  });
});
