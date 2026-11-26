import { beforeEach, describe, expect, test, vi } from "vitest";
import * as xlsx from "xlsx";
import { prisma } from "@formbricks/database";
import { createWorkspaceWithContactDirectory } from "@/integration/contact-directory-fixture";
import { resetDb } from "@/integration/reset-db";
import { type TAnalysisRow, openAnalysisExport } from "@/lib/analysis-export";
import { getDisplaysBySurveyIdWithContact } from "@/lib/display/service";
import { getResponseDownloadFile } from "@/lib/response/service";

/**
 * Decision 8 against real Postgres, for the downloads and the Impressions list: a contact the workspace no
 * longer reaches (another contact directory, or the workspace has none) shows none of its current
 * attributes. The exports keep the response's saved contactAttributes, which are the response's own.
 */

vi.mock("@/modules/ee/license-check/lib/utils", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/modules/ee/license-check/lib/utils")>()),
  getIsQuotasEnabled: async () => false,
}));

beforeEach(async () => {
  await resetDb();
});

const seed = async () => {
  const organization = await prisma.organization.create({ data: { name: "Exports Org" } });
  const { workspaceId, directoryId } = await createWorkspaceWithContactDirectory(organization.id, "Current");
  const { directoryId: oldDirectoryId } = await createWorkspaceWithContactDirectory(organization.id, "Old");

  const createContact = async (contactDirectoryId: string, name: string) => {
    const contact = await prisma.contact.create({
      data: { directoryId: contactDirectoryId, workspaceId },
      select: { id: true },
    });
    for (const [key, value] of [
      ["userId", `${name}-current-user-id`],
      ["email", `${name}-current@example.com`],
    ]) {
      const attributeKey = await prisma.contactAttributeKey.upsert({
        where: { directoryId_key: { directoryId: contactDirectoryId, key } },
        create: { key, name: key, type: "default", directoryId: contactDirectoryId },
        update: {},
        select: { id: true },
      });
      await prisma.contactAttribute.create({
        data: { contactId: contact.id, attributeKeyId: attributeKey.id, value },
      });
    }
    return contact.id;
  };

  const reachedContact = await createContact(directoryId, "reached");
  const oldContact = await createContact(oldDirectoryId, "old");

  const survey = await prisma.survey.create({
    data: { name: "App survey", type: "app", status: "inProgress", workspaceId },
    select: { id: true },
  });
  for (const [contactId, name, createdAt] of [
    [reachedContact, "reached", new Date("2026-11-02T00:00:00Z")],
    [oldContact, "old", new Date("2026-11-01T00:00:00Z")],
  ] as const) {
    await prisma.response.create({
      data: {
        surveyId: survey.id,
        contactId,
        createdAt,
        finished: true,
        data: {},
        contactAttributes: { userId: `${name}-saved-user-id` },
      },
    });
    await prisma.display.create({ data: { surveyId: survey.id, contactId, createdAt } });
  }

  return { workspaceId, surveyId: survey.id, reachedContact, oldContact };
};

const removeFromDirectory = (workspaceId: string) =>
  prisma.workspace.update({ where: { id: workspaceId }, data: { contactDirectoryId: null } });

/** The exported file's rows by header, so a cell is read by its column. */
const exportRows = async (surveyId: string, format: "csv" | "xlsx") => {
  const { fileContents } = await getResponseDownloadFile(surveyId, format);
  const workbook = xlsx.read(fileContents, { type: format === "xlsx" ? "base64" : "string" });
  return xlsx.utils.sheet_to_json<Record<string, string>>(workbook.Sheets[workbook.SheetNames[0]], {
    defval: "",
    raw: false,
  });
};

const analysisUserIds = async (surveyId: string) => {
  const exported = await openAnalysisExport({ surveyId, fields: { contact: true } });
  const rows: TAnalysisRow[] = [];
  for await (const batch of exported.rows()) rows.push(...batch);
  const userIdColumn = exported.columns.findIndex((column) => column.name === "user_id");
  const contactIdColumn = exported.columns.findIndex((column) => column.name === "contact_id");
  return rows.map((row) => ({ contactId: row.codes?.[contactIdColumn], userId: row.codes?.[userIdColumn] }));
};

describe.each(["csv", "xlsx"] as const)("Standard export (%s)", (format) => {
  test("exports the current userId only for contacts the workspace reaches", async () => {
    const { surveyId, reachedContact, oldContact } = await seed();

    const rows = await exportRows(surveyId, format);

    expect(
      rows.map((row) => [row["Formbricks ID (internal)"], row["User ID"], row["person.userId"]])
    ).toEqual([
      [reachedContact, "reached-current-user-id", "reached-saved-user-id"],
      [oldContact, "", "old-saved-user-id"],
    ]);
  });

  test("exports no current userId at all once the workspace has no directory", async () => {
    const { workspaceId, surveyId } = await seed();
    await removeFromDirectory(workspaceId);

    const rows = await exportRows(surveyId, format);

    expect(rows.map((row) => [row["User ID"], row["person.userId"]])).toEqual([
      ["", "reached-saved-user-id"],
      ["", "old-saved-user-id"],
    ]);
  });
});

describe("Analysis export", () => {
  test("exports the current userId only for contacts the workspace reaches", async () => {
    const { surveyId, reachedContact, oldContact } = await seed();

    expect(await analysisUserIds(surveyId)).toEqual([
      { contactId: reachedContact, userId: "reached-current-user-id" },
      { contactId: oldContact, userId: null },
    ]);
  });
});

describe("Summary Impressions", () => {
  test("marks a display's contact of another directory unavailable, without its email or userId", async () => {
    const { surveyId, reachedContact, oldContact } = await seed();

    const displays = await getDisplaysBySurveyIdWithContact(surveyId);

    expect(displays.map(({ contact }) => contact)).toEqual([
      {
        id: reachedContact,
        attributes: { email: "reached-current@example.com", userId: "reached-current-user-id" },
      },
      { id: oldContact, attributes: {}, unavailable: true },
    ]);
  });

  test("marks every display contact unavailable once the workspace has no directory", async () => {
    const { workspaceId, surveyId } = await seed();
    await removeFromDirectory(workspaceId);

    const displays = await getDisplaysBySurveyIdWithContact(surveyId);

    expect(displays.map(({ contact }) => contact?.unavailable)).toEqual([true, true]);
    expect(JSON.stringify(displays)).not.toContain("current");
  });
});
