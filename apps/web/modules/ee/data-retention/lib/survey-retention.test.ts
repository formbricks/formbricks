import { describe, expect, test } from "vitest";
import { RETENTION_POLICY_DEFAULTS } from "./policy-rules";
import { addRetentionDays } from "./schedule";
import { type TSurveyRetentionFacts, getSurveyRetentionPlan } from "./survey-retention";

const NOW = new Date("2030-06-01T00:00:00.000Z");
const ENABLED_AT = new Date("2029-01-01T00:00:00.000Z");
const daysAgo = (days: number) => addRetentionDays(NOW, -days);

const on = {
  responses: { ...RETENTION_POLICY_DEFAULTS.responses, enabled: true, enabledAt: ENABLED_AT },
  surveys: { ...RETENTION_POLICY_DEFAULTS.surveys, enabled: true, enabledAt: ENABLED_AT },
};

const survey: TSurveyRetentionFacts = {
  createdAt: daysAgo(2000),
  updatedAt: daysAgo(1500),
  archivedAt: null,
  oldestResponseAt: daysAgo(1100),
  newestResponseAt: daysAgo(1080),
  surveysNotice: null,
  responsesNotice: null,
  surveyHeldUntil: null,
  responsesHeldUntil: null,
};

const plan = (overrides: Partial<Parameters<typeof getSurveyRetentionPlan>[0]> = {}) =>
  getSurveyRetentionPlan({ policies: on, survey, exemptPolicies: new Set(), now: NOW, ...overrides });

describe("getSurveyRetentionPlan", () => {
  test("dates each active policy with the schedule the sweep uses", () => {
    const [responses, surveys] = plan();

    // The oldest response passed its 3 years 5 days ago, but no reminder has gone out yet: the first
    // deletion waits the full warning after the next run sends it.
    expect(responses).toEqual({
      policy: "responses",
      exempt: false,
      nextAction: "delete",
      nextDate: addRetentionDays(NOW, 60),
      dueCreatedAtOrBefore: daysAgo(1095 - 60),
    });
    // No notice has gone out yet, so the archive waits the full 60 days from the next sweep.
    expect(surveys).toEqual({
      policy: "surveys",
      exempt: false,
      nextAction: "archive",
      nextDate: addRetentionDays(NOW, 60),
      dueCreatedAtOrBefore: null,
    });
  });

  test("once the reminder has run its warning, due responses go on the next run", () => {
    const delivered = daysAgo(61);
    const [responses] = plan({
      survey: { ...survey, responsesNotice: { claimedAt: delivered, deliveredAt: delivered, clockAt: null } },
    });

    expect(responses).toMatchObject({ nextAction: "delete", nextDate: NOW });
  });

  test("a reminder from before the responses exemption ended no longer counts", () => {
    const delivered = daysAgo(61);
    const [responses] = plan({
      survey: {
        ...survey,
        responsesNotice: { claimedAt: delivered, deliveredAt: delivered, clockAt: null },
        responsesHeldUntil: daysAgo(1),
      },
    });

    expect(responses.nextDate).toEqual(addRetentionDays(NOW, 60));
  });

  test("dates the archive from a delivered notice only while the survey's clock is the one it was sent for", () => {
    const delivered = daysAgo(10);
    // The survey's clock under the default conditions: its last response, the latest of its timestamps.
    const clock = survey.newestResponseAt!;
    const noticed = (clockAt: Date) => ({
      ...survey,
      surveysNotice: { claimedAt: delivered, deliveredAt: delivered, clockAt },
    });

    const [, current] = plan({ survey: noticed(clock) });
    expect(current.nextDate).toEqual(addRetentionDays(delivered, 60));

    // Activity since the notice: it no longer counts, and the archive waits a full warning again.
    const [, moved] = plan({ survey: noticed(daysAgo(1100)) });
    expect(moved.nextDate).toEqual(addRetentionDays(NOW, 60));
  });

  test("dates an archived survey's deletion from when it was archived", () => {
    const archivedAt = daysAgo(10);
    const [, surveys] = plan({ survey: { ...survey, archivedAt } });

    expect(surveys).toMatchObject({ nextAction: "delete", nextDate: addRetentionDays(archivedAt, 30) });
  });

  test("doesn't count responses when even the oldest is still outside the warning window", () => {
    const [responses] = plan({
      survey: { ...survey, oldestResponseAt: daysAgo(400), newestResponseAt: daysAgo(10) },
    });

    expect(responses).toMatchObject({
      nextAction: "delete",
      nextDate: addRetentionDays(daysAgo(400), 1095),
      dueCreatedAtOrBefore: null,
    });
  });

  test("leaves paused policies out, and says nothing about responses a survey doesn't have", () => {
    expect(plan({ policies: { ...on, surveys: { ...on.surveys, enabled: false } } })).toHaveLength(1);
    expect(plan({ survey: { ...survey, oldestResponseAt: null, newestResponseAt: null } })[0]).toMatchObject({
      policy: "responses",
      nextAction: null,
      nextDate: null,
      dueCreatedAtOrBefore: null,
    });
  });

  test("holds a survey from the surveys policy under either exemption, but its responses only under theirs", () => {
    const [responses, surveys] = plan({ exemptPolicies: new Set(["responses"]) });
    expect(responses).toMatchObject({ exempt: true, nextAction: null, nextDate: null });
    expect(surveys).toMatchObject({ exempt: true, nextAction: null, nextDate: null });

    const [stillDeleted, held] = plan({ exemptPolicies: new Set(["surveys"]) });
    expect(stillDeleted).toMatchObject({ exempt: false, nextAction: "delete" });
    expect(held).toMatchObject({ exempt: true, nextAction: null });
  });

  test("never dates a deletion before a just-enabled responses policy has warned in full", () => {
    const [responses] = plan({ policies: { ...on, responses: { ...on.responses, enabledAt: NOW } } });

    expect(responses.nextDate).toEqual(addRetentionDays(NOW, 60));
  });
});
