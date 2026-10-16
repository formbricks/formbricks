import type { TCreativeDisplayState, TCreativeStatusInput } from "./display-status";

/**
 * The one case table both derivations answer to: `getCreativeDisplayState` (TS) and
 * `creativeDisplayStatusSql` (its SQL twin, run against PostgreSQL in the integration suite). A row
 * added here is checked on both sides, so the list filter and the rows it returns can't disagree.
 *
 * Times are relative to `DISPLAY_STATUS_NOW`; the expected values come from the derivation order in
 * the spec (Derived status), not from either implementation.
 */
export const DISPLAY_STATUS_NOW = new Date("2026-10-15T12:00:00.000Z");

const hoursFromNow = (hours: number): Date => new Date(DISPLAY_STATUS_NOW.getTime() + hours * 3_600_000);

const ACTIVE_SURVEY = { status: "inProgress", archivedAt: null } as const;

const live: TCreativeStatusInput = {
  status: "inProgress",
  archivedAt: null,
  startAt: null,
  endAt: null,
  destinationSurvey: ACTIVE_SURVEY,
};

export type TDisplayStatusCase = {
  name: string;
  input: TCreativeStatusInput;
  expected: TCreativeDisplayState;
};

export const DISPLAY_STATUS_CASES: readonly TDisplayStatusCase[] = [
  {
    name: "published, survey running, no schedule: active",
    input: live,
    expected: { status: "active", reason: null },
  },
  {
    name: "published link creative (no survey): active",
    input: { ...live, destinationSurvey: null },
    expected: { status: "active", reason: null },
  },
  {
    name: "archived wins over a draft with a future start",
    input: { ...live, status: "draft", archivedAt: hoursFromNow(-1), startAt: hoursFromNow(5) },
    expected: { status: "archived", reason: null },
  },
  {
    name: "archived wins over a paused survey",
    input: {
      ...live,
      archivedAt: hoursFromNow(-1),
      destinationSurvey: { status: "paused", archivedAt: null },
    },
    expected: { status: "archived", reason: null },
  },
  {
    name: "draft is the author's word, even before its start or after its end",
    input: { ...live, status: "draft", startAt: hoursFromNow(5), endAt: hoursFromNow(-1) },
    expected: { status: "draft", reason: null },
  },
  {
    name: "draft is the author's word, even when its survey is paused",
    input: { ...live, status: "draft", destinationSurvey: { status: "paused", archivedAt: null } },
    expected: { status: "draft", reason: null },
  },
  {
    name: "completed reads closed, with no reason",
    input: { ...live, status: "completed" },
    expected: { status: "closed", reason: null },
  },
  {
    name: "an ended schedule closes a published creative",
    input: { ...live, endAt: hoursFromNow(-1) },
    expected: { status: "closed", reason: "scheduleEnded" },
  },
  {
    name: "the end instant itself is closed",
    input: { ...live, endAt: DISPLAY_STATUS_NOW },
    expected: { status: "closed", reason: "scheduleEnded" },
  },
  {
    name: "an ended schedule outranks the author's pause",
    input: { ...live, status: "paused", endAt: hoursFromNow(-1) },
    expected: { status: "closed", reason: "scheduleEnded" },
  },
  {
    name: "an ended schedule outranks a paused survey",
    input: { ...live, endAt: hoursFromNow(-1), destinationSurvey: { status: "paused", archivedAt: null } },
    expected: { status: "closed", reason: "scheduleEnded" },
  },
  {
    name: "the author's pause carries no reason",
    input: { ...live, status: "paused" },
    expected: { status: "paused", reason: null },
  },
  {
    name: "the author's pause outranks a future start",
    input: { ...live, status: "paused", startAt: hoursFromNow(5) },
    expected: { status: "paused", reason: null },
  },
  {
    name: "the author's pause outranks a paused survey, and keeps no reason",
    input: { ...live, status: "paused", destinationSurvey: { status: "paused", archivedAt: null } },
    expected: { status: "paused", reason: null },
  },
  {
    name: "before its start a published creative is scheduled",
    input: { ...live, startAt: hoursFromNow(1), endAt: hoursFromNow(3) },
    expected: { status: "scheduled", reason: null },
  },
  {
    name: "scheduled outranks a paused survey",
    input: { ...live, startAt: hoursFromNow(1), destinationSurvey: { status: "paused", archivedAt: null } },
    expected: { status: "scheduled", reason: null },
  },
  {
    name: "the start instant itself is no longer scheduled",
    input: { ...live, startAt: DISPLAY_STATUS_NOW },
    expected: { status: "active", reason: null },
  },
  {
    name: "inside its schedule, with its survey running: active",
    input: { ...live, startAt: hoursFromNow(-1), endAt: hoursFromNow(1) },
    expected: { status: "active", reason: null },
  },
  {
    name: "a paused survey pauses it with the reason",
    input: { ...live, destinationSurvey: { status: "paused", archivedAt: null } },
    expected: { status: "paused", reason: "surveyNotActive" },
  },
  {
    name: "a completed survey pauses it with the reason",
    input: { ...live, destinationSurvey: { status: "completed", archivedAt: null } },
    expected: { status: "paused", reason: "surveyNotActive" },
  },
  {
    name: "a draft survey pauses it with the reason",
    input: { ...live, destinationSurvey: { status: "draft", archivedAt: null } },
    expected: { status: "paused", reason: "surveyNotActive" },
  },
  {
    name: "an archived survey still marked in progress pauses it with the reason",
    input: { ...live, destinationSurvey: { status: "inProgress", archivedAt: hoursFromNow(-2) } },
    expected: { status: "paused", reason: "surveyNotActive" },
  },
];
