import { beforeEach, describe, expect, test, vi } from "vitest";
import { prisma } from "@formbricks/database";
import { findSurveyOutboundBlockers } from "@/app/api/v3/surveys/visibility/blockers";
import { resetDb } from "@/integration/reset-db";
import { queueAuditEventWithoutRequest } from "@/modules/ee/audit-logs/lib/handler";
import { purgeExpiredArchivedSurveys } from "@/modules/survey/archive/lib/process-survey-archive-purge-job";
import { deleteSurvey } from "@/modules/survey/lib/surveys";
import { LINKED_CREATIVES_READ_LIMIT, SurveyLinkedCreativesError } from "./linked-creatives";

/**
 * The survey side of a creative's Destination against a real PostgreSQL: the queries behind the
 * delete guard, the unlink before a delete (the Destination foreign key is NO ACTION), the
 * purge, and the creative visibility blockers.
 */

vi.mock("node:crypto", async (importOriginal) => await importOriginal<typeof import("node:crypto")>());
vi.mock("crypto", async (importOriginal) => await importOriginal<typeof import("crypto")>());

vi.mock("@/modules/ee/audit-logs/lib/handler", () => ({
  queueAuditEventWithoutRequest: vi.fn().mockResolvedValue(undefined),
}));

const DAY = 24 * 60 * 60 * 1000;

let organizationId: string;
let workspaceId: string;

const createSurvey = async (data: { archivedAt?: Date } = {}) =>
  (await prisma.survey.create({ data: { name: "Site visit", type: "app", workspaceId, ...data } })).id;

const createCreative = async (name: string, surveyId: string | null, archivedAt: Date | null = null) =>
  (
    await prisma.creative.create({
      data: {
        name,
        type: "feedbackButton",
        status: "inProgress",
        workspaceId,
        surveyId,
        archivedAt,
        content: {},
        styling: {},
      },
    })
  ).id;

const surveyIdOf = async (creativeId: string) =>
  (await prisma.creative.findUniqueOrThrow({ where: { id: creativeId }, select: { surveyId: true } }))
    .surveyId;

beforeEach(async () => {
  vi.clearAllMocks();
  await resetDb();
  organizationId = (await prisma.organization.create({ data: { name: "Acme" } })).id;
  workspaceId = (await prisma.workspace.create({ data: { name: "Europe", organizationId } })).id;
});

describe("deleting a survey that creatives open", () => {
  test("is refused while a non-archived creative links it, naming that one only", async () => {
    const surveyId = await createSurvey();
    const tab = await createCreative("Feedback tab", surveyId);
    await createCreative("Old tab", surveyId, new Date());

    const refusal = await deleteSurvey(surveyId).catch((error: unknown) => error);

    expect(refusal).toBeInstanceOf(SurveyLinkedCreativesError);
    expect((refusal as SurveyLinkedCreativesError).creatives).toEqual([{ id: tab, name: "Feedback tab" }]);
    expect(await prisma.survey.count({ where: { id: surveyId } })).toBe(1);
    expect(await surveyIdOf(tab)).toBe(surveyId);
  });

  test("goes through when only archived creatives open it, unlinking them first", async () => {
    const surveyId = await createSurvey();
    const archived = await createCreative("Old tab", surveyId, new Date());
    const elsewhere = await createCreative("Other tab", await createSurvey());
    const onCreativesUnlinked = vi.fn();

    await deleteSurvey(surveyId, { onCreativesUnlinked });

    expect(await prisma.survey.count({ where: { id: surveyId } })).toBe(0);
    expect(await surveyIdOf(archived)).toBeNull();
    expect(await surveyIdOf(elsewhere)).not.toBeNull();
    expect(onCreativesUnlinked).toHaveBeenCalledWith([{ id: archived, name: "Old tab" }], { organizationId });
  });
});

describe("the 30-day archive purge", () => {
  test("purges a survey creatives still open, unlinking every one with a system audit entry", async () => {
    const surveyId = await createSurvey({ archivedAt: new Date(Date.now() - 31 * DAY) });
    const tab = await createCreative("Feedback tab", surveyId);
    const archived = await createCreative("Old tab", surveyId, new Date());

    expect(await purgeExpiredArchivedSurveys()).toBe(1);

    expect(await prisma.survey.count({ where: { id: surveyId } })).toBe(0);
    expect(await surveyIdOf(tab)).toBeNull();
    expect(await surveyIdOf(archived)).toBeNull();
    for (const creativeId of [tab, archived]) {
      expect(queueAuditEventWithoutRequest).toHaveBeenCalledWith(
        expect.objectContaining({
          action: "updated",
          targetType: "creative",
          targetId: creativeId,
          userType: "system",
          organizationId,
          oldObject: { surveyId },
          newObject: { surveyId: null },
        })
      );
    }
  });

  test("unlinks and audits every creative even when more open the survey than one read returns", async () => {
    const surveyId = await createSurvey({ archivedAt: new Date(Date.now() - 31 * DAY) });
    const count = LINKED_CREATIVES_READ_LIMIT + 1;
    await prisma.creative.createMany({
      data: Array.from({ length: count }, (_, index) => ({
        name: `Tab ${String(index).padStart(3, "0")}`,
        type: "feedbackButton" as const,
        status: "inProgress" as const,
        workspaceId,
        surveyId,
        content: {},
        styling: {},
      })),
    });

    expect(await purgeExpiredArchivedSurveys()).toBe(1);

    expect(await prisma.creative.count({ where: { workspaceId, surveyId: { not: null } } })).toBe(0);
    const creativeAudits = vi
      .mocked(queueAuditEventWithoutRequest)
      .mock.calls.filter(([event]) => event.targetType === "creative");
    expect(creativeAudits).toHaveLength(count);
  });
});

describe("findSurveyOutboundBlockers", () => {
  test("lists the survey's non-archived creatives as creative blockers, and nothing else of theirs", async () => {
    const surveyId = await createSurvey();
    const tab = await createCreative("Feedback tab", surveyId);
    await createCreative("Old tab", surveyId, new Date());
    await createCreative("Other tab", await createSurvey());

    expect(await findSurveyOutboundBlockers(surveyId, workspaceId)).toEqual([
      { id: tab, name: "Feedback tab", type: "creative" },
    ]);
  });
});
