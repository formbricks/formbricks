import { afterEach, beforeEach, describe, expect, test } from "vitest";
import type { TSegment } from "@formbricks/types/segment";
import { type TSurvey, ZSurvey } from "@formbricks/types/surveys/types";
import { mockSurveyWithLogic } from "@/lib/survey/__mock__/survey.mock";
import { withPageDates } from "./survey-dates";

const REPORTED_MESSAGE = "Invalid input: expected date, received Date";

// The built-in constructor, kept so each test can put it back.
const BuiltInDate = globalThis.Date;

// A page whose `Date` a script or extension has replaced, as time-zone switchers do: Dates built with
// `new Date()` are instances of the replacement, while `structuredClone` still returns built-in ones.
const replacePageDate = () => {
  class ReplacedDate extends BuiltInDate {}
  globalThis.Date = ReplacedDate as DateConstructor;
};

const createdAt = new BuiltInDate("2026-10-20T08:12:33.123Z");
const updatedAt = new BuiltInDate("2026-10-20T08:15:00.000Z");
const publishOn = new BuiltInDate("2026-10-25T10:00:00.000Z");
const closeOn = new BuiltInDate("2026-10-27T10:00:00.000Z");

// A fresh draft as the editor loads it: Response Options untouched, so no schedule.
const freshDraft = (): TSurvey =>
  ({
    ...mockSurveyWithLogic,
    languages: [],
    endings: [],
    followUps: [],
    blocks: [
      {
        id: "block1",
        name: "Block 1",
        elements: [
          {
            id: "rating1",
            type: "rating",
            headline: { default: "Rate us" },
            required: true,
            scale: "star",
            range: 5,
            lowerLabel: { default: "Not good" },
            upperLabel: { default: "Very good" },
            isColorCodingEnabled: false,
          },
        ],
      },
    ],
    createdAt,
    updatedAt,
    status: "draft",
    publishOn: null,
    closeOn: null,
  }) as TSurvey;

// The editor seeds its working copy with `structuredClone(survey)` (survey-editor.tsx).
const editorWorkingCopy = (survey: TSurvey): TSurvey => structuredClone(survey);

// What `handleSurveyPublish` and `handleSurveySchedule` validate and send.
const activationPayload = (survey: TSurvey, status: "inProgress" | "paused") =>
  withPageDates({ ...survey, status, segment: survey.segment });

describe("withPageDates", () => {
  beforeEach(() => {
    replacePageDate();
  });

  afterEach(() => {
    globalThis.Date = BuiltInDate;
  });

  test("reproduces the reported error on the working copy before its dates are rebuilt", () => {
    const result = ZSurvey.safeParse(editorWorkingCopy(freshDraft()));

    expect(result.success).toBe(false);
    expect(result.error?.issues.map((issue) => issue.message)).toContain(REPORTED_MESSAGE);
  });

  test("activating a fresh survey now passes validation with the same instants", () => {
    const payload = activationPayload(editorWorkingCopy(freshDraft()), "inProgress");

    const result = ZSurvey.safeParse(payload);

    expect(result.success, JSON.stringify(result.error?.issues)).toBe(true);
    expect(result.data?.status).toBe("inProgress");
    expect(result.data?.createdAt.getTime()).toBe(createdAt.getTime());
    expect(result.data?.updatedAt.getTime()).toBe(updatedAt.getTime());
    expect(result.data?.publishOn).toBeNull();
    expect(result.data?.closeOn).toBeNull();
  });

  test("scheduling keeps the chosen activation and close dates", () => {
    const scheduled = editorWorkingCopy({ ...freshDraft(), publishOn, closeOn });

    const result = ZSurvey.safeParse(activationPayload(scheduled, "paused"));

    expect(result.success, JSON.stringify(result.error?.issues)).toBe(true);
    expect(result.data?.status).toBe("paused");
    expect(result.data?.publishOn?.getTime()).toBe(publishOn.getTime());
    expect(result.data?.closeOn?.getTime()).toBe(closeOn.getTime());
  });

  test("rebuilds the nested dates and leaves every other field as it was", () => {
    const segment: TSegment = {
      id: "temp",
      title: "segment",
      description: null,
      isPrivate: true,
      filters: [],
      workspaceId: mockSurveyWithLogic.workspaceId,
      surveys: [mockSurveyWithLogic.id],
      createdAt,
      updatedAt,
    };
    const language = {
      id: "lang1",
      code: "de",
      alias: null,
      workspaceId: mockSurveyWithLogic.workspaceId,
      createdAt,
      updatedAt,
    };
    const followUp = {
      id: "followup1",
      name: "Follow-up",
      surveyId: mockSurveyWithLogic.id,
      trigger: { type: "response" as const, properties: null },
      action: {} as TSurvey["followUps"][number]["action"],
      createdAt,
      updatedAt,
    };
    const actionClass = { ...mockSurveyWithLogic.triggers[0]?.actionClass, createdAt, updatedAt };
    const survey = editorWorkingCopy({
      ...freshDraft(),
      triggers: [{ actionClass }],
      segment,
      languages: [{ language, default: true, enabled: true }],
      followUps: [followUp],
    });

    const normalized = withPageDates(survey);

    const nestedDates = [
      normalized.triggers[0].actionClass.createdAt,
      normalized.triggers[0].actionClass.updatedAt,
      normalized.segment?.createdAt,
      normalized.segment?.updatedAt,
      normalized.languages[0].language.createdAt,
      normalized.languages[0].language.updatedAt,
      normalized.followUps[0].createdAt,
      normalized.followUps[0].updatedAt,
    ];
    for (const date of nestedDates) {
      expect(date).toBeInstanceOf(Date);
    }
    expect(normalized.segment?.createdAt?.getTime()).toBe(createdAt.getTime());

    // Same survey once every date is read as its timestamp.
    const asTimestamps = (value: unknown) => JSON.parse(JSON.stringify(value)) as unknown;
    expect(asTimestamps(normalized)).toEqual(asTimestamps(survey));
  });

  test("leaves a Date of this page as the same object", () => {
    const pageDate = new Date(createdAt.getTime());
    const survey = { ...freshDraft(), createdAt: pageDate };

    expect(withPageDates(survey).createdAt).toBe(pageDate);
  });

  test("still refuses an Invalid Date", () => {
    const survey = { ...freshDraft(), updatedAt: new BuiltInDate("not a date") };

    const result = ZSurvey.safeParse(withPageDates(survey));

    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.path).toEqual(["updatedAt"]);
  });
});
