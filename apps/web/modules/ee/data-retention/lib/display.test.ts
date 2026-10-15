import type { TFunction } from "i18next";
import { describe, expect, test } from "vitest";
import type { TRetentionRun, TSurveyRetentionPolicy } from "../types";
import {
  createRetentionCountFormatter,
  formatRetentionDate,
  formatRetentionNotice,
  formatRetentionPeriod,
  formatRetentionRunTime,
  getRetentionHistoryCounts,
  getRetentionPolicyLabel,
  getRetentionPolicySummary,
  getSurveyRetentionDueWarning,
  getSurveyRetentionExemptLines,
  getSurveyRetentionLines,
} from "./display";
import { RETENTION_POLICY_DEFAULTS } from "./policy-rules";

const run = (policy: TRetentionRun["policy"]): TRetentionRun => ({
  id: "run_1",
  policy,
  startedAt: "2030-01-01T02:00:00.000Z",
  finishedAt: null,
  notified: 3,
  archived: 5,
  deleted: 7,
  skipped: 1,
});

describe("getRetentionHistoryCounts", () => {
  test("responses show their one-time notices and their deletions, and have no archive", () => {
    expect(getRetentionHistoryCounts(run("responses"))).toEqual({
      notified: 3,
      archived: null,
      deletedOrDeactivated: 7,
    });
  });

  test("surveys show notices, archives and the deletions the archive purge recorded", () => {
    expect(getRetentionHistoryCounts(run("surveys"))).toEqual({
      notified: 3,
      archived: 5,
      deletedOrDeactivated: 7,
    });
  });

  test("members' deactivations, which the API reports as archived, go in the last column", () => {
    expect(getRetentionHistoryCounts(run("members"))).toEqual({
      notified: 3,
      archived: null,
      deletedOrDeactivated: 5,
    });
  });

  test("keeps a real zero rather than showing it as missing", () => {
    expect(getRetentionHistoryCounts({ ...run("surveys"), archived: 0 }).archived).toBe(0);
    expect(getRetentionHistoryCounts({ ...run("responses"), notified: 0 }).notified).toBe(0);
  });
});

describe("getRetentionPolicyLabel", () => {
  test("uses the shared labels for each kind of data", () => {
    const t = ((key: string) => key) as unknown as TFunction;

    expect(getRetentionPolicyLabel("responses", t)).toBe("common.responses");
    expect(getRetentionPolicyLabel("surveys", t)).toBe("common.surveys");
    expect(getRetentionPolicyLabel("members", t)).toBe("common.members");
  });
});

describe("createRetentionCountFormatter", () => {
  test("groups digits for the given locale and shows a missing step as a dash", () => {
    expect(createRetentionCountFormatter("en-US")(12345)).toBe("12,345");
    expect(createRetentionCountFormatter("de-DE")(12345)).toBe("12.345");
    expect(createRetentionCountFormatter("en-US")(0)).toBe("0");
    expect(createRetentionCountFormatter("en-US")(null)).toBe("—");
  });
});

describe("formatRetentionNotice", () => {
  const t = ((key: string, values?: Record<string, unknown>) =>
    `${key.split(".").pop()} ${JSON.stringify(values)}`) as unknown as TFunction;

  test("states a notice in days, however many months it makes", () => {
    expect(formatRetentionNotice(60, t)).toBe('period_days {"count":60}');
    expect(formatRetentionNotice(14, t)).toBe('period_days {"count":14}');
  });
});

describe("formatRetentionRunTime", () => {
  test("shows the day and time in the organisation's time zone", () => {
    expect(formatRetentionRunTime("2031-03-31T22:30:00.000Z", "en-US", "Europe/Berlin")).toBe(
      "Apr 1, 2031, 12:30 AM"
    );
  });
});

describe("formatRetentionDate", () => {
  test("shows the calendar day in the organisation's time zone, not the browser's", () => {
    expect(formatRetentionDate("2031-03-31T21:59:59.999Z", "en-US", "Europe/Berlin")).toBe("Mar 31, 2031");
    expect(formatRetentionDate("2031-03-31T21:59:59.999Z", "en-US", "Asia/Tokyo")).toBe("Apr 1, 2031");
  });
});

describe("policy summaries", () => {
  // Echo the key and its values, so the test shows which copy and which numbers were chosen.
  const t = ((key: string, values?: Record<string, unknown>) =>
    values
      ? `${key.split(".").pop()} ${JSON.stringify(values)}`
      : (key.split(".").pop() as string)) as unknown as TFunction;

  test("states a period in the largest unit it fits", () => {
    expect(formatRetentionPeriod(1095, t)).toBe('period_years {"count":3}');
    expect(formatRetentionPeriod(180, t)).toBe('period_months {"count":6}');
    expect(formatRetentionPeriod(45, t)).toBe('period_days {"count":45}');
  });

  test("summarises each policy by its own period, and the surveys policy by its conditions", () => {
    expect(getRetentionPolicySummary("responses", RETENTION_POLICY_DEFAULTS.responses, t, "en-US")).toBe(
      'responses_summary {"period":"period_years {\\"count\\":3}"}'
    );
    expect(getRetentionPolicySummary("surveys", RETENTION_POLICY_DEFAULTS.surveys, t, "en-US")).toContain(
      '"conditions":"condition_no_response_short and condition_no_change_short"'
    );
    expect(getRetentionPolicySummary("members", RETENTION_POLICY_DEFAULTS.members, t, "en-US")).toBe(
      'members_summary {"period":"period_years {\\"count\\":1}"}'
    );
  });
});

describe("survey retention copy", () => {
  const echo = ((key: string, values?: Record<string, unknown>) =>
    values
      ? `${key.split(".").pop()} ${JSON.stringify(values)}`
      : (key.split(".").pop() as string)) as unknown as TFunction;
  const formatDate = (iso: string) => iso.slice(0, 10);
  const exemption = {
    id: "clexm",
    surveyId: "clsrv",
    surveyName: "Site visit",
    workspaceId: "clwsp",
    policy: "responses" as const,
    until: "2031-03-31T21:59:59.999Z",
    source: "manual" as const,
    reason: "Audit",
    createdBy: null,
    createdAt: "2030-01-01T00:00:00.000Z",
    revokedAt: null,
  };
  const plan = (policy: "responses" | "surveys", rest: Partial<TSurveyRetentionPolicy> = {}) => ({
    policy,
    exempt: false,
    nextAction: null,
    nextDate: null,
    dueCount: null,
    ...rest,
  });

  test("states each policy's next step and date, or its exemption", () => {
    expect(
      getSurveyRetentionLines(
        {
          governed: true,
          policies: [
            plan("responses", { nextAction: "delete", nextDate: "2030-10-03T00:00:00.000Z" }),
            plan("surveys", { exempt: true }),
          ],
          exemptions: [exemption],
        },
        echo,
        formatDate
      )
    ).toEqual([
      'survey_line_responses_delete {"date":"2030-10-03"}',
      // Held by the responses exemption, the only one there is (ENG-3371).
      'survey_line_exempt {"policy":"surveys","date":"2031-03-31"}',
    ]);
  });

  test("a survey held by both kinds of exemption shows the one that ends last; responses only their own", () => {
    const surveysUntilDecember = {
      ...exemption,
      id: "clsrvexm",
      policy: "surveys" as const,
      until: "2026-12-31T00:00:00.000Z",
    };
    const responsesUntilJune = {
      ...exemption,
      id: "clrspexm",
      policy: "responses" as const,
      until: "2027-06-30T00:00:00.000Z",
    };
    const lines = getSurveyRetentionLines(
      {
        governed: true,
        policies: [plan("responses", { exempt: true }), plan("surveys", { exempt: true })],
        exemptions: [surveysUntilDecember, responsesUntilJune],
      },
      echo,
      formatDate
    );
    expect(lines).toEqual([
      'survey_line_exempt {"policy":"responses","date":"2027-06-30"}',
      // Either kind holds the survey itself, so the later end decides.
      'survey_line_exempt {"policy":"surveys","date":"2027-06-30"}',
    ]);
    expect(
      getSurveyRetentionLines(
        {
          governed: true,
          policies: [plan("responses", { exempt: true }), plan("surveys", { exempt: true })],
          exemptions: [{ ...surveysUntilDecember, until: "2028-01-31T00:00:00.000Z" }, responsesUntilJune],
        },
        echo,
        formatDate
      )
    ).toEqual([
      // A surveys exemption doesn't hold the responses.
      'survey_line_exempt {"policy":"responses","date":"2027-06-30"}',
      'survey_line_exempt {"policy":"surveys","date":"2028-01-31"}',
    ]);
  });

  test("the summary note repeats only the exemptions, not the dates", () => {
    const retention = {
      governed: true,
      policies: [
        plan("responses", { nextAction: "delete" as const, nextDate: "2030-10-03T00:00:00.000Z" }),
        plan("surveys", { exempt: true }),
      ],
      exemptions: [{ ...exemption, policy: "surveys" as const }],
    };
    expect(getSurveyRetentionExemptLines(retention, echo, formatDate)).toEqual([
      'survey_line_exempt {"policy":"surveys","date":"2031-03-31"}',
    ]);
    expect(
      getSurveyRetentionExemptLines({ ...retention, policies: [plan("responses")] }, echo, formatDate)
    ).toEqual([]);
  });

  test("says when nothing is due, and tells an archive from a deletion", () => {
    const lines = getSurveyRetentionLines(
      {
        governed: true,
        policies: [
          plan("responses"),
          plan("surveys", { nextAction: "delete", nextDate: "2030-07-01T00:00:00.000Z" }),
        ],
        exemptions: [],
      },
      echo,
      formatDate
    );
    expect(lines).toEqual([
      'survey_line_nothing_due {"policy":"responses"}',
      'survey_line_survey_delete {"date":"2030-07-01"}',
    ]);
  });

  test("warns about responses already due, with a capped count shown as a lower bound", () => {
    const due = (count: number, relation: "eq" | "gte") => ({
      governed: true,
      policies: [
        plan("responses", {
          nextAction: "delete" as const,
          nextDate: "2030-10-03T00:00:00.000Z",
          dueCount: { count, relation },
        }),
      ],
      exemptions: [],
    });

    expect(getSurveyRetentionDueWarning(due(214, "eq"), echo, "en-US", formatDate)).toBe(
      'responses_due_for_deletion {"count":214,"date":"2030-10-03"}'
    );
    expect(getSurveyRetentionDueWarning(due(10000, "gte"), echo, "en-US", formatDate)).toBe(
      'responses_due_for_deletion_capped {"total":"10,000","date":"2030-10-03"}'
    );
    expect(
      getSurveyRetentionDueWarning(
        { governed: true, policies: [plan("responses")], exemptions: [] },
        echo,
        "en-US",
        formatDate
      )
    ).toBeNull();
  });
});
