import { beforeEach, describe, expect, test } from "vitest";
import { prisma } from "@formbricks/database";
import { resetDb } from "@/integration/reset-db";
import { listActiveSurveyRetentionExemptions } from "./exemptions-service";
import { updateRetentionPolicy } from "./policies-service";
import {
  countSurveyResponsesCreatedAtOrBefore,
  getSurveyRetentionFacts,
  getSurveyRetentionPolicies,
} from "./survey-retention-service";

const DAY = 24 * 60 * 60 * 1000;
const NOW = new Date("2030-06-01T00:00:00.000Z");
const daysAgo = (days: number) => new Date(NOW.getTime() - days * DAY);

describe("survey retention service (real Postgres)", () => {
  let organizationId: string;
  let surveyId: string;
  let otherSurveyId: string;

  beforeEach(async () => {
    await resetDb();
    organizationId = (await prisma.organization.create({ data: { name: "Retention Org" } })).id;
    const workspaceId = (await prisma.workspace.create({ data: { name: "Europe", organizationId } })).id;
    surveyId = (await prisma.survey.create({ data: { name: "Site visit", workspaceId } })).id;
    otherSurveyId = (await prisma.survey.create({ data: { name: "Other", workspaceId } })).id;
    await prisma.response.createMany({
      data: [10, 20, 30, 40, 50].map((age) => ({ surveyId, createdAt: daysAgo(age) })),
    });
    await prisma.response.create({ data: { surveyId: otherSurveyId, createdAt: daysAgo(500) } });
  });

  test("reads a survey's timestamps, its oldest and newest response, and its notice", async () => {
    await prisma.retentionNotice.create({
      data: { organizationId, entity: "surveys", surveyId, sentAt: daysAgo(3) },
    });

    expect(await getSurveyRetentionFacts(surveyId)).toMatchObject({
      archivedAt: null,
      oldestResponseAt: daysAgo(50),
      newestResponseAt: daysAgo(10),
      surveysNoticeSentAt: daysAgo(3),
    });
    expect(await getSurveyRetentionFacts(otherSurveyId)).toMatchObject({ surveysNoticeSentAt: null });
    expect(await getSurveyRetentionFacts("clmissingmissingmissingmi")).toBeNull();
  });

  test("counts only this survey's responses up to the cutoff, stopping at the cap", async () => {
    expect(await countSurveyResponsesCreatedAtOrBefore(surveyId, daysAgo(30))).toEqual({
      count: 3,
      relation: "eq",
    });
    expect(await countSurveyResponsesCreatedAtOrBefore(surveyId, NOW, 2)).toEqual({
      count: 2,
      relation: "gte",
    });
    expect(await countSurveyResponsesCreatedAtOrBefore(surveyId, daysAgo(60))).toEqual({
      count: 0,
      relation: "eq",
    });
  });

  test("lists only this survey's active exemptions", async () => {
    await prisma.retentionExemption.createMany({
      data: [
        { organizationId, surveyId, entity: "surveys", until: daysAgo(-30), reason: "Audit" },
        { organizationId, surveyId, entity: "responses", until: daysAgo(1), reason: "Ended" },
        { organizationId, surveyId: otherSurveyId, entity: "surveys", until: daysAgo(-30), reason: "Other" },
      ],
    });

    const rows = await listActiveSurveyRetentionExemptions(surveyId, NOW);

    expect(rows.map((row) => [row.entity, row.reason])).toEqual([["surveys", "Audit"]]);
  });

  test("gives the two survey policies with when each took effect", async () => {
    const userId = (await prisma.user.create({ data: { name: "Anna", email: "anna@example.com" } })).id;
    await updateRetentionPolicy({
      organizationId,
      policy: "responses",
      patch: { enabled: true },
      updatedById: userId,
      now: NOW,
    });

    const policies = await getSurveyRetentionPolicies(organizationId);

    expect(policies.responses).toMatchObject({ enabled: true, enabledAt: NOW, deleteDays: 1095 });
    expect(policies.surveys).toMatchObject({ enabled: false, enabledAt: null });
  });
});
