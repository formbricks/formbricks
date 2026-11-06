import { createId } from "@paralleldrive/cuid2";
import { beforeAll, describe, expect, test } from "vitest";
import * as XLSX from "xlsx";
import { prisma } from "@formbricks/database";
import type { TV3AuditLog } from "@/app/api/v3/lib/types";
import { synchronizeAuthzedIntegrationFixture } from "@/integration/authzed";
import { type TDashboardsFixture, seedDashboardsFixture, sessionOf } from "@/integration/dashboards-fixture";
import { getContentDispositionFileName } from "@/lib/utils/file-download";
import { EXCEL_EXPORT_META_SHEET } from "@/modules/survey/excel-export/write";
import type { TSurveyExportFormat } from "@/modules/survey/export/lib/formats";
import { ZFormbricksFileV1 } from "@/modules/survey/formbricks-file/envelope";
import { exportSurveyOperation } from "./operations";

/**
 * The survey export (ENG-6847) against real PostgreSQL and SpiceDB: who may export, the bytes and
 * headers that come back, and the references the file embeds from the survey's workspace.
 */

let fixture: TDashboardsFixture;
let draftSurveyId: string;
let appSurveyId: string;
let actionClassId: string;

const BLOCKS = [
  {
    id: createId(),
    name: "Block 1",
    elements: [
      {
        id: "satisfaction",
        type: "openText",
        headline: { default: "What should we improve?" },
        required: true,
        inputType: "text",
        charLimit: { enabled: false },
      },
    ],
  },
];

const exportAs = (
  userId: string,
  surveyId: string,
  auditLog?: TV3AuditLog,
  format: TSurveyExportFormat = "json"
) =>
  exportSurveyOperation({
    surveyId,
    format,
    authentication: sessionOf(userId),
    requestId: "req_export",
    instance: `/api/internal/surveys/${surveyId}/export`,
    auditLog,
  });

const auditLogStub = (): TV3AuditLog =>
  ({
    action: "exported",
    targetType: "survey",
    userId: "unknown",
    targetId: "unknown",
    organizationId: "unknown",
    status: "failure",
    userType: "user",
  }) as TV3AuditLog;

beforeAll(async () => {
  fixture = await seedDashboardsFixture();

  const draft = await prisma.survey.create({
    data: {
      name: "Größe NPS / Q4",
      type: "link",
      status: "draft",
      workspaceId: fixture.workspaceId,
      ownerId: fixture.users.editor,
      blocks: BLOCKS,
    },
    select: { id: true },
  });
  draftSurveyId = draft.id;

  const actionClass = await prisma.actionClass.create({
    data: { name: "Checkout", type: "code", key: "checkout", workspaceId: fixture.workspaceId },
  });
  actionClassId = actionClass.id;
  await prisma.contactAttributeKey.createMany({
    data: [
      { key: "plan", name: "Plan", description: "Billing plan", workspaceId: fixture.workspaceId },
      { key: "unused", name: "Unused", workspaceId: fixture.workspaceId },
    ],
  });
  const segment = await prisma.segment.create({
    data: {
      title: createId(),
      isPrivate: true,
      workspaceId: fixture.workspaceId,
      filters: [
        {
          id: createId(),
          connector: null,
          resource: {
            id: createId(),
            root: { type: "attribute", contactAttributeKey: "plan" },
            qualifier: { operator: "equals" },
            value: "pro",
          },
        },
      ],
    },
  });
  const app = await prisma.survey.create({
    data: {
      name: "In-app survey",
      type: "app",
      status: "inProgress",
      workspaceId: fixture.workspaceId,
      ownerId: fixture.users.editor,
      blocks: BLOCKS,
      segmentId: segment.id,
      triggers: { create: { actionClassId: actionClass.id } },
    },
    select: { id: true },
  });
  appSurveyId = app.id;

  await synchronizeAuthzedIntegrationFixture();
}, 120_000);

describe("GET /api/internal/surveys/{surveyId}/export", () => {
  test("a read-only member exports a draft as <name>.formbricks.json with the agreed headers, audited", async () => {
    const auditLog = auditLogStub();
    const response = await exportAs(fixture.users.viewer, draftSurveyId, auditLog);

    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe("application/json");
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(response.headers.get("Content-Disposition")).toBe(
      `attachment; filename="Gro_e NPS Q4.formbricks.json"; filename*=UTF-8''Gr%C3%B6%C3%9Fe%20NPS%20Q4.formbricks.json`
    );
    expect(getContentDispositionFileName(response.headers.get("Content-Disposition"))).toBe(
      "Größe NPS Q4.formbricks.json"
    );

    const bytes = new Uint8Array(await response.arrayBuffer());
    expect(response.headers.get("Content-Length")).toBe(String(bytes.byteLength));

    const file = JSON.parse(new TextDecoder().decode(bytes));
    expect(ZFormbricksFileV1.safeParse(file).error?.issues).toBeUndefined();
    expect(file.formbricks).toMatchObject({
      format: 1,
      source: { surveyId: draftSurveyId, workspaceId: fixture.workspaceId },
    });
    expect(file.survey).toMatchObject({
      name: "Größe NPS / Q4",
      status: "draft",
      blocks: [{ id: BLOCKS[0].id, elements: [{ id: "satisfaction" }] }],
    });

    expect(auditLog).toMatchObject({
      organizationId: fixture.organizationId,
      targetId: draftSurveyId,
      newObject: { format: "json", fileFormat: 1, workspaceId: fixture.workspaceId },
    });
  });

  test("answers an unknown survey and one the caller may not read the same way, and audits neither", async () => {
    const outsiderAudit = auditLogStub();
    const unknownAudit = auditLogStub();
    const forbidden = await exportAs(fixture.users.outsider, draftSurveyId, outsiderAudit);
    const unknown = await exportAs(fixture.users.viewer, createId(), unknownAudit);

    expect(forbidden.status).toBe(403);
    expect(unknown.status).toBe(403);
    // Everything but `instance`, which echoes the requested path.
    const { instance: _forbiddenInstance, ...forbiddenBody } = await forbidden.json();
    const { instance: _unknownInstance, ...unknownBody } = await unknown.json();
    expect(forbiddenBody).toEqual(unknownBody);
    expect(forbidden.headers.get("Content-Disposition")).toBeNull();
    expect(outsiderAudit.organizationId).toBe("unknown");
    expect(unknownAudit.organizationId).toBe("unknown");
  });

  test("embeds the action classes an app survey's triggers use and the attribute keys its targeting names", async () => {
    const response = await exportAs(fixture.users.viewer, appSurveyId);
    expect(response.status).toBe(200);

    const file = await response.json();
    expect(ZFormbricksFileV1.safeParse(file).error?.issues).toBeUndefined();
    expect(file.survey.distribution.triggers).toEqual([{ actionClassId }]);
    expect(file.references).toEqual({
      actionClasses: [
        {
          id: actionClassId,
          name: "Checkout",
          description: null,
          type: "code",
          key: "checkout",
          noCodeConfig: null,
        },
      ],
      attributeKeys: [{ key: "plan", name: "Plan", description: "Billing plan", dataType: "string" }],
      embeddedFields: [],
      languages: [],
    });
  });

  test("a read-only member exports a draft as <name>.xlsx: one row per text, keyed, as typed text, audited", async () => {
    const auditLog = auditLogStub();
    const response = await exportAs(fixture.users.viewer, draftSurveyId, auditLog, "xlsx");

    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe(
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(getContentDispositionFileName(response.headers.get("Content-Disposition"))).toBe(
      "Größe NPS Q4.xlsx"
    );

    const bytes = new Uint8Array(await response.arrayBuffer());
    expect(response.headers.get("Content-Length")).toBe(String(bytes.byteLength));

    const workbook = XLSX.read(bytes, { type: "array", cellFormula: true, cellNF: true });
    const [sheetName, metaName] = workbook.SheetNames;
    expect(metaName).toBe(EXCEL_EXPORT_META_SHEET);
    expect(workbook.Workbook?.Sheets?.map((sheet) => sheet.Hidden)).toEqual([0, 2]);

    const rows = XLSX.utils.sheet_to_json<string[]>(workbook.Sheets[sheetName], { header: 1, defval: "" });
    expect(rows.map((row) => [row[0], row[1], row[3]])).toEqual([
      ["key", expect.any(String), expect.any(String)],
      ["element.satisfaction.headline", "satisfaction", "What should we improve?"],
    ]);
    for (const sheet of Object.values(workbook.Sheets)) {
      for (const [address, cell] of Object.entries(sheet)) {
        if (address.startsWith("!")) continue;
        expect({ address, t: cell.t, z: cell.z, f: cell.f }).toEqual({
          address,
          t: "s",
          z: "@",
          f: undefined,
        });
      }
    }

    const { updatedAt } = await prisma.survey.findUniqueOrThrow({
      where: { id: draftSurveyId },
      select: { updatedAt: true },
    });
    expect(XLSX.utils.sheet_to_json<string[]>(workbook.Sheets[metaName], { header: 1 })).toEqual([
      ["surveyId", draftSurveyId],
      ["updatedAt", updatedAt.toISOString()],
      ["format", "1"],
    ]);

    expect(auditLog).toMatchObject({
      organizationId: fixture.organizationId,
      targetId: draftSurveyId,
      newObject: { format: "xlsx", fileFormat: 1, workspaceId: fixture.workspaceId },
    });
  });

  test("refuses an Excel export to a caller who may not read the survey, without a file", async () => {
    const response = await exportAs(fixture.users.outsider, draftSurveyId, undefined, "xlsx");

    expect(response.status).toBe(403);
    expect(response.headers.get("Content-Disposition")).toBeNull();
  });
});
