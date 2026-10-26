import { describe, expect, test } from "vitest";
import { V3ApiError } from "@/modules/api/lib/v3-client";
import {
  type TSurveyLinkedCreative,
  getCreativeOpenedMode,
  getCreativesToKeepPaused,
  getLinkedCreativesBlockers,
  isDestinationSettingLocked,
  leavesSurveyUnopened,
  planSurveyStatusChange,
} from "./survey-side";

const NOW = new Date("2026-10-16T12:00:00.000Z");

const creative = (overrides: Partial<TSurveyLinkedCreative> & { id: string }): TSurveyLinkedCreative => ({
  name: overrides.id,
  status: "inProgress",
  displayStatus: "active",
  displayStatusReason: null,
  archivedAt: null,
  schedule: { startAt: null, endAt: null },
  ...overrides,
});

describe("planSurveyStatusChange", () => {
  test("pausing an active survey names every creative that opens it, and which ones it takes down", () => {
    const shown = creative({ id: "shown", name: "Feedback tab" });
    const scheduled = creative({
      id: "scheduled",
      displayStatus: "scheduled",
      schedule: { startAt: "2026-11-01T00:00:00.000Z", endAt: null },
    });
    const draft = creative({ id: "draft", status: "draft", displayStatus: "draft" });
    const pausedByAuthor = creative({ id: "paused", status: "paused", displayStatus: "paused" });
    const closedByAuthor = creative({ id: "closed", status: "completed", displayStatus: "closed" });
    const ended = creative({
      id: "ended",
      displayStatus: "closed",
      displayStatusReason: "scheduleEnded",
      schedule: { startAt: null, endAt: "2026-10-01T00:00:00.000Z" },
    });

    const plan = planSurveyStatusChange({
      from: "inProgress",
      to: "paused",
      creatives: [shown, scheduled, draft, pausedByAuthor, closedByAuthor, ended],
      now: NOW,
    });

    expect(plan).toEqual({
      kind: "pause",
      creatives: [shown, scheduled, draft, pausedByAuthor, closedByAuthor, ended],
      affected: [shown, scheduled],
    });
  });

  test("closing an active survey names them as a close", () => {
    const shown = creative({ id: "shown" });

    expect(
      planSurveyStatusChange({ from: "inProgress", to: "completed", creatives: [shown], now: NOW })
    ).toEqual({ kind: "close", creatives: [shown], affected: [shown] });
  });

  test("resuming a paused or closed survey names every creative, and the ones that come back with it", () => {
    const pausedWithSurvey = creative({
      id: "back",
      displayStatus: "paused",
      displayStatusReason: "surveyNotActive",
    });
    const pausedByAuthor = creative({ id: "stays", status: "paused", displayStatus: "paused" });

    for (const from of ["paused", "completed"] as const) {
      expect(
        planSurveyStatusChange({
          from,
          to: "inProgress",
          creatives: [pausedWithSurvey, pausedByAuthor],
          now: NOW,
        })
      ).toEqual({
        kind: "resume",
        creatives: [pausedWithSurvey, pausedByAuthor],
        affected: [pausedWithSurvey],
      });
    }
  });

  test("names a draft too, though the change takes nothing down", () => {
    const draft = creative({ id: "draft", status: "draft", displayStatus: "draft" });

    expect(
      planSurveyStatusChange({ from: "inProgress", to: "paused", creatives: [draft], now: NOW })
    ).toEqual({ kind: "pause", creatives: [draft], affected: [] });
  });

  test("asks nothing when no creative opens the survey", () => {
    expect(planSurveyStatusChange({ from: "paused", to: "inProgress", creatives: [], now: NOW })).toBeNull();
  });

  test("asks nothing when the survey neither stops nor restarts", () => {
    const shown = creative({ id: "shown" });

    expect(
      planSurveyStatusChange({ from: "paused", to: "completed", creatives: [shown], now: NOW })
    ).toBeNull();
    expect(
      planSurveyStatusChange({ from: "completed", to: "paused", creatives: [shown], now: NOW })
    ).toBeNull();
    expect(
      planSurveyStatusChange({ from: "inProgress", to: "inProgress", creatives: [shown], now: NOW })
    ).toBeNull();
    // Publishing a draft is not a resume: the editor publishes without this dialog.
    expect(
      planSurveyStatusChange({ from: "draft", to: "inProgress", creatives: [shown], now: NOW })
    ).toBeNull();
  });
});

describe("getCreativesToKeepPaused", () => {
  const back = creative({ id: "back", displayStatus: "paused", displayStatusReason: "surveyNotActive" });
  const alsoBack = creative({
    id: "also-back",
    displayStatus: "paused",
    displayStatusReason: "surveyNotActive",
  });

  test("keeping them paused pauses every creative the resume would bring back", () => {
    // A creative its author paused stays out of it: pausing it again would change nothing.
    const stays = creative({ id: "stays", status: "paused", displayStatus: "paused" });
    const plan = { kind: "resume" as const, creatives: [back, stays, alsoBack], affected: [back, alsoBack] };

    expect(getCreativesToKeepPaused(plan, true)).toEqual(["back", "also-back"]);
  });

  test("letting them come back pauses nothing", () => {
    expect(getCreativesToKeepPaused({ kind: "resume", creatives: [back], affected: [back] }, false)).toEqual(
      []
    );
  });

  test("only a resume offers the choice", () => {
    expect(getCreativesToKeepPaused({ kind: "pause", creatives: [back], affected: [back] }, true)).toEqual(
      []
    );
  });
});

describe("getCreativeOpenedMode", () => {
  const trigger = { actionClass: { id: "action_1" } };
  const linked = [creative({ id: "tab", status: "draft", displayStatus: "draft" })];

  test("a survey only creatives open has its recontact settings switched off", () => {
    expect(getCreativeOpenedMode({ triggers: [], creatives: linked })).toBe("creativesOnly");
  });

  test("a survey with actions of its own keeps them, for its automatic popups", () => {
    expect(getCreativeOpenedMode({ triggers: [trigger], creatives: linked })).toBe("creativesAndActions");
  });

  test("an empty slot the editor leaves in the trigger list is not an action", () => {
    expect(getCreativeOpenedMode({ triggers: [undefined, null], creatives: linked })).toBe("creativesOnly");
  });

  test("a survey no creative opens is left as it is", () => {
    expect(getCreativeOpenedMode({ triggers: [], creatives: [] })).toBeNull();
    expect(getCreativeOpenedMode({ triggers: [trigger], creatives: [] })).toBeNull();
  });
});

describe("getLinkedCreativesBlockers", () => {
  const refusal = (details: unknown) =>
    new V3ApiError({
      status: 409,
      detail: "Delete the creatives that open this survey before deleting it",
      code: "survey_has_linked_creatives",
      details,
    });

  test("a delete refused because creatives open the survey lists them as creative blockers", () => {
    const error = refusal({
      creatives: [
        { id: "creative_1", name: "Feedback tab" },
        { id: "creative_2", name: "Maintenance notice" },
      ],
    });

    expect(getLinkedCreativesBlockers(error)).toEqual([
      { id: "creative_1", name: "Feedback tab", type: "creative" },
      { id: "creative_2", name: "Maintenance notice", type: "creative" },
    ]);
  });

  test("a refusal whose details can't be read is still a refusal, naming no one", () => {
    expect(getLinkedCreativesBlockers(refusal(undefined))).toEqual([]);
    expect(getLinkedCreativesBlockers(refusal({ creatives: "Feedback tab" }))).toEqual([]);
  });

  test("any other failure is not a linked-creatives refusal", () => {
    const conflict = new V3ApiError({ status: 409, detail: "Conflict", code: "conflict" });

    expect(getLinkedCreativesBlockers(conflict)).toBeNull();
    expect(getLinkedCreativesBlockers(new Error("survey_has_linked_creatives"))).toBeNull();
  });
});

describe("isDestinationSettingLocked", () => {
  const linked = [creative({ id: "tab" })];

  test("a survey creatives open can't turn on single-use links or a PIN", () => {
    expect(isDestinationSettingLocked({ creatives: linked, isOn: false })).toBe(true);
  });

  test("a setting already on can still be turned off", () => {
    expect(isDestinationSettingLocked({ creatives: linked, isOn: true })).toBe(false);
  });

  test("a survey no creative opens is free to turn it on", () => {
    expect(isDestinationSettingLocked({ creatives: [], isOn: false })).toBe(false);
  });
});

describe("leavesSurveyUnopened", () => {
  const liveAppSurvey = { type: "app", status: "inProgress", triggers: [] } as const;
  const last = [creative({ id: "tab" })];
  const leaves = (survey: Parameters<typeof leavesSurveyUnopened>[0]["survey"]) =>
    leavesSurveyUnopened({ survey, linkedCreatives: last, creativeId: "tab" });

  test("taking the last creative off a live app survey with no action of its own leaves nothing to open it", () => {
    expect(leaves(liveAppSurvey)).toBe(true);
  });

  test("another creative, a draft included, still opens it", () => {
    const withDraft = [...last, creative({ id: "draft", status: "draft", displayStatus: "draft" })];

    expect(
      leavesSurveyUnopened({ survey: liveAppSurvey, linkedCreatives: withDraft, creativeId: "tab" })
    ).toBe(false);
  });

  test("an action of its own, a link survey or a survey that isn't running needs no warning", () => {
    expect(leaves({ ...liveAppSurvey, triggers: [{ actionClassId: "clicked-help" }] })).toBe(false);
    expect(leaves({ ...liveAppSurvey, type: "link" })).toBe(false);
    expect(leaves({ ...liveAppSurvey, status: "paused" })).toBe(false);
    expect(leaves({ ...liveAppSurvey, status: "draft" })).toBe(false);
  });
});
