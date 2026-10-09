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
      data: {
        organizationId,
        entity: "surveys",
        surveyId,
        sentAt: daysAgo(3),
        deliveredAt: daysAgo(3),
        emailSent: true,
        clockAt: daysAgo(10),
      },
    });

    const survey = await prisma.survey.findUniqueOrThrow({ where: { id: surveyId } });
    const other = await prisma.survey.findUniqueOrThrow({ where: { id: otherSurveyId } });

    expect(await getSurveyRetentionFacts(survey, new Date())).toEqual({
      createdAt: survey.createdAt,
      updatedAt: survey.updatedAt,
      archivedAt: null,
      oldestResponseAt: daysAgo(50),
      newestResponseAt: daysAgo(10),
      surveysNotice: { claimedAt: daysAgo(3), deliveredAt: daysAgo(3), clockAt: daysAgo(10) },
      responsesNotice: null,
      surveyHeldUntil: null,
      responsesHeldUntil: null,
    });
    expect(await getSurveyRetentionFacts(other, new Date())).toMatchObject({
      oldestResponseAt: daysAgo(500),
      surveysNotice: null,
    });
  });

  test("reads when each policy's latest exemption ended, early revocations and expiries alike", async () => {
    const survey = await prisma.survey.findUniqueOrThrow({ where: { id: surveyId } });
    const realNow = new Date();
    const ago = (days: number) => new Date(realNow.getTime() - days * DAY);
    await prisma.retentionExemption.createMany({
      data: [
        // Surveys: one expired 10 days ago, one revoked 3 days ago though it ran for another month.
        {
          organizationId,
          surveyId,
          entity: "surveys",
          until: ago(10),
          reason: "Expired",
          revokedAt: ago(10),
        },
        {
          organizationId,
          surveyId,
          entity: "surveys",
          until: ago(-30),
          reason: "Revoked",
          revokedAt: ago(3),
        },
        // Responses: one still running, which doesn't count as ended, and one expired 5 days ago.
        { organizationId, surveyId, entity: "responses", until: ago(-30), reason: "Running" },
      ],
    });
    await prisma.retentionExemption.create({
      data: {
        organizationId,
        surveyId,
        entity: "responses",
        until: ago(5),
        reason: "Expired",
        revokedAt: ago(5),
      },
    });

    const facts = await getSurveyRetentionFacts(survey, realNow);

    expect(facts.responsesHeldUntil?.getTime()).toBe(ago(5).getTime());
    // Either policy's exemption holds the survey itself, so the later of the two ends counts.
    expect(facts.surveyHeldUntil?.getTime()).toBe(ago(3).getTime());
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
        // Revoked while it still had time to run.
        {
          organizationId,
          surveyId,
          entity: "responses",
          until: daysAgo(-60),
          reason: "Revoked",
          revokedAt: daysAgo(2),
        },
        { organizationId, surveyId: otherSurveyId, entity: "surveys", until: daysAgo(-30), reason: "Other" },
      ],
    });

    const rows = await listActiveSurveyRetentionExemptions({ surveyId, organizationId, now: NOW });

    expect(rows.map((row) => [row.entity, row.reason])).toEqual([["surveys", "Audit"]]);
  });

  test("matches the organisation too, so a row filed under another one never shows", async () => {
    const foreignOrganizationId = (await prisma.organization.create({ data: { name: "Foreign" } })).id;
    // Never written by the app, which takes the organisation from the survey; fenced anyway.
    await prisma.retentionExemption.create({
      data: {
        organizationId: foreignOrganizationId,
        surveyId,
        entity: "responses",
        until: daysAgo(-30),
        reason: "Foreign",
      },
    });

    expect(await listActiveSurveyRetentionExemptions({ surveyId, organizationId, now: NOW })).toEqual([]);
    expect(
      await listActiveSurveyRetentionExemptions({ surveyId, organizationId: foreignOrganizationId, now: NOW })
    ).toHaveLength(1);
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

    expect(policies.responses).toMatchObject({ enabled: true, enabledAt: NOW, periodDays: 1095 });
    expect(policies.surveys).toMatchObject({ enabled: false, enabledAt: null });
  });
});
