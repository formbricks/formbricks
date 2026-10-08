import { describe, expect, test } from "vitest";
import {
  type TRetentionSchedulePolicy,
  type TRetentionTargetState,
  addRetentionDays,
  getDueRetentionStep,
  getMemberRetentionClock,
  getRetentionClockCutoffs,
  getRetentionSchedule,
  getSurveyRetentionClock,
} from "./schedule";

const day = (offset: number): Date => addRetentionDays(new Date("2030-01-01T00:00:00.000Z"), offset);

const surveysPolicy: TRetentionSchedulePolicy = {
  entity: "surveys",
  enabledAt: day(-1000),
  warnDays: 30,
  archiveDays: 365,
  deleteDays: 30,
};

const responsesPolicy: TRetentionSchedulePolicy = {
  entity: "responses",
  enabledAt: day(-1000),
  warnDays: 30,
  archiveDays: null,
  deleteDays: 730,
};

const membersPolicy: TRetentionSchedulePolicy = {
  entity: "members",
  enabledAt: day(-1000),
  warnDays: 60,
  archiveDays: 365,
  deleteDays: null,
};

const target = (overrides: Partial<TRetentionTargetState> = {}): TRetentionTargetState => ({
  clock: day(0),
  noticeSentAt: null,
  archivedAt: null,
  ...overrides,
});

describe("getRetentionSchedule", () => {
  test("plans every stage from the clock when the notice goes out on time", () => {
    const schedule = getRetentionSchedule(surveysPolicy, target({ noticeSentAt: day(335) }), day(340));

    expect(schedule).toEqual({
      warnAt: day(335),
      noticeAt: day(335),
      noticeSent: true,
      archiveAt: day(365),
      deleteAt: day(395),
    });
  });

  describe("the warning always runs in full", () => {
    test("a notice sent late pushes the archive back to a full warning after it", () => {
      const schedule = getRetentionSchedule(surveysPolicy, target({ noticeSentAt: day(500) }), day(510));

      expect(schedule.archiveAt).toEqual(day(530));
      expect(schedule.deleteAt).toEqual(day(560));
    });

    test("a notice that is overdue but unsent is projected from now, not from the clock", () => {
      const schedule = getRetentionSchedule(surveysPolicy, target(), day(500));

      expect(schedule.noticeSent).toBe(false);
      expect(schedule.noticeAt).toEqual(day(500));
      expect(schedule.archiveAt).toEqual(day(530));
    });

    test("nothing is archived until a notice is on record, however old the clock", () => {
      expect(getDueRetentionStep(surveysPolicy, target(), day(5000))).toBe("notify");
      expect(getDueRetentionStep(surveysPolicy, target({ noticeSentAt: day(4990) }), day(5000))).toBeNull();
      expect(getDueRetentionStep(surveysPolicy, target({ noticeSentAt: day(4970) }), day(5000))).toBe(
        "archive"
      );
    });

    test("responses, which get no notice, wait a full warning after the policy is switched on", () => {
      const policy = { ...responsesPolicy, enabledAt: day(1000) };

      expect(getRetentionSchedule(policy, target(), day(1000)).deleteAt).toEqual(day(1030));
      expect(getDueRetentionStep(policy, target(), day(1029))).toBeNull();
      expect(getDueRetentionStep(policy, target(), day(1030))).toBe("delete");
    });
  });

  describe("delete follows the actual archive", () => {
    test("counts from when the target was archived, not from when it was planned", () => {
      const archived = target({ noticeSentAt: day(335), archivedAt: day(400) });

      expect(getRetentionSchedule(surveysPolicy, archived, day(401)).deleteAt).toEqual(day(430));
      expect(getDueRetentionStep(surveysPolicy, archived, day(429))).toBeNull();
      expect(getDueRetentionStep(surveysPolicy, archived, day(430))).toBe("delete");
    });

    test("a target archived by hand is deleted on the same schedule", () => {
      const archived = target({ archivedAt: day(10) });

      expect(getRetentionSchedule(surveysPolicy, archived, day(11)).deleteAt).toEqual(day(40));
    });

    test("a policy without a delete stage never deletes", () => {
      const deactivated = target({ noticeSentAt: day(305), archivedAt: day(365) });

      expect(getRetentionSchedule(membersPolicy, deactivated, day(9000)).deleteAt).toBeNull();
      expect(getDueRetentionStep(membersPolicy, deactivated, day(9000))).toBeNull();
    });
  });

  describe("a clock reset voids the notice", () => {
    test("a notice older than the clock no longer counts", () => {
      const reset = target({ clock: day(400), noticeSentAt: day(335) });
      const schedule = getRetentionSchedule(surveysPolicy, reset, day(401));

      expect(schedule.noticeSent).toBe(false);
      expect(schedule.warnAt).toEqual(day(735));
      expect(schedule.archiveAt).toEqual(day(765));
      expect(getDueRetentionStep(surveysPolicy, reset, day(401))).toBeNull();
    });

    test("the next cycle sends a new notice before anything is archived", () => {
      const reset = target({ clock: day(400), noticeSentAt: day(335) });

      expect(getDueRetentionStep(surveysPolicy, reset, day(765))).toBe("notify");
    });

    test("a notice sent at the same instant as the clock still counts", () => {
      expect(getRetentionSchedule(surveysPolicy, target({ noticeSentAt: day(0) }), day(1)).noticeSent).toBe(
        true
      );
    });
  });

  describe("a policy switched on, unpaused or tightened voids older notices (ENG-3614)", () => {
    // Paused after the notice went out, unpaused much later: the clock never moved, so without this
    // rule the old notice would archive the survey the night the policy is unpaused.
    const unpaused = { ...surveysPolicy, enabledAt: day(800) };

    test("a notice sent before the policy took effect no longer counts", () => {
      const schedule = getRetentionSchedule(unpaused, target({ noticeSentAt: day(335) }), day(801));

      expect(schedule.noticeSent).toBe(false);
      expect(schedule.archiveAt).toEqual(day(831));
    });

    test("the next cycle sends a new notice and archives only after a full warning", () => {
      expect(getDueRetentionStep(unpaused, target({ noticeSentAt: day(335) }), day(801))).toBe("notify");
      expect(getDueRetentionStep(unpaused, target({ noticeSentAt: day(801) }), day(830))).toBeNull();
      expect(getDueRetentionStep(unpaused, target({ noticeSentAt: day(801) }), day(831))).toBe("archive");
    });

    test("a notice sent after the policy took effect still counts", () => {
      const current = { ...surveysPolicy, enabledAt: day(300) };

      expect(getRetentionSchedule(current, target({ noticeSentAt: day(335) }), day(340)).noticeSent).toBe(
        true
      );
    });
  });

  test("policies without an archive step act on the clock with delete", () => {
    expect(getRetentionSchedule(responsesPolicy, target(), day(1))).toEqual({
      warnAt: day(700),
      noticeAt: null,
      noticeSent: false,
      archiveAt: null,
      deleteAt: day(730),
    });
  });

  test("a policy that is off is planned as if it were switched on now", () => {
    const off = { ...responsesPolicy, enabledAt: null };

    expect(getRetentionSchedule(off, target(), day(2000)).deleteAt).toEqual(day(2030));
  });

  test("a warning longer than the period starts the notice at the clock's own past", () => {
    const shortPolicy = { ...surveysPolicy, warnDays: 90, archiveDays: 60 };

    expect(getRetentionSchedule(shortPolicy, target({ noticeSentAt: day(0) }), day(0)).archiveAt).toEqual(
      day(90)
    );
  });

  test("rejects a policy with no action stage", () => {
    expect(() =>
      getRetentionSchedule({ ...surveysPolicy, archiveDays: null, deleteDays: null }, target(), day(0))
    ).toThrow();
  });
});

describe("getDueRetentionStep", () => {
  test("walks a survey through notify → archive → delete", () => {
    expect(getDueRetentionStep(surveysPolicy, target(), day(334))).toBeNull();
    expect(getDueRetentionStep(surveysPolicy, target(), day(335))).toBe("notify");
    expect(getDueRetentionStep(surveysPolicy, target({ noticeSentAt: day(335) }), day(364))).toBeNull();
    expect(getDueRetentionStep(surveysPolicy, target({ noticeSentAt: day(335) }), day(365))).toBe("archive");
    expect(
      getDueRetentionStep(surveysPolicy, target({ noticeSentAt: day(335), archivedAt: day(365) }), day(394))
    ).toBeNull();
    expect(
      getDueRetentionStep(surveysPolicy, target({ noticeSentAt: day(335), archivedAt: day(365) }), day(395))
    ).toBe("delete");
  });

  test("deactivates a member after the notice and stops there", () => {
    expect(getDueRetentionStep(membersPolicy, target(), day(305))).toBe("notify");
    expect(getDueRetentionStep(membersPolicy, target({ noticeSentAt: day(305) }), day(365))).toBe("archive");
  });
});

describe("getRetentionClockCutoffs", () => {
  // The sweep's SQL selects with these bounds and re-checks each row with getDueRetentionStep, so the
  // two must agree exactly at the boundary: a clock on the cutoff is due, one millisecond later isn't.
  const justAfter = (date: Date) => new Date(date.getTime() + 1);

  test.each([surveysPolicy, membersPolicy])("agrees with the notice step for $entity", (policy) => {
    const now = day(5000);
    const { noticeDueAtOrBefore } = getRetentionClockCutoffs(policy, now);

    expect(getDueRetentionStep(policy, target({ clock: noticeDueAtOrBefore }), now)).toBe("notify");
    expect(getDueRetentionStep(policy, target({ clock: justAfter(noticeDueAtOrBefore) }), now)).toBeNull();
  });

  test.each([surveysPolicy, membersPolicy])(
    "agrees with the first action for $entity once the notice has run",
    (policy) => {
      const now = day(5000);
      const { actionDueAtOrBefore } = getRetentionClockCutoffs(policy, now);
      const noticeSentAt = addRetentionDays(now, -policy.warnDays);
      if (!actionDueAtOrBefore) throw new Error("expected a cutoff");

      expect(getDueRetentionStep(policy, target({ clock: actionDueAtOrBefore, noticeSentAt }), now)).toBe(
        "archive"
      );
      expect(
        getDueRetentionStep(policy, target({ clock: justAfter(actionDueAtOrBefore), noticeSentAt }), now)
      ).toBe(null);
    }
  );

  test("agrees with the delete step for responses", () => {
    const now = day(5000);
    const { actionDueAtOrBefore } = getRetentionClockCutoffs(responsesPolicy, now);
    if (!actionDueAtOrBefore) throw new Error("expected a cutoff");

    expect(getDueRetentionStep(responsesPolicy, target({ clock: actionDueAtOrBefore }), now)).toBe("delete");
    expect(
      getDueRetentionStep(responsesPolicy, target({ clock: justAfter(actionDueAtOrBefore) }), now)
    ).toBeNull();
  });

  test("selects no responses until the policy has been on for a full warning", () => {
    const policy = { ...responsesPolicy, enabledAt: day(1000) };

    expect(getRetentionClockCutoffs(policy, day(1029)).actionDueAtOrBefore).toBeNull();
    expect(getRetentionClockCutoffs(policy, day(1030)).actionDueAtOrBefore).toEqual(day(300));
  });
});

describe("getSurveyRetentionClock", () => {
  const survey = { createdAt: day(0), updatedAt: day(100), lastResponseAt: day(200) };

  test("always counts updatedAt, whatever is ticked", () => {
    expect(getSurveyRetentionClock({ ...survey, lastResponseAt: null }, ["createdBefore"])).toEqual(day(100));
  });

  test("counts the last response when 'no response' is ticked", () => {
    expect(getSurveyRetentionClock(survey, ["noResponse"])).toEqual(day(200));
    expect(getSurveyRetentionClock(survey, ["noChange"])).toEqual(day(100));
  });

  test("a survey with no responses satisfies 'no response' from its other clocks", () => {
    expect(getSurveyRetentionClock({ ...survey, lastResponseAt: null }, ["noResponse"])).toEqual(day(100));
  });

  test("a restore, which bumps updatedAt, restarts the period", () => {
    expect(getSurveyRetentionClock({ ...survey, updatedAt: day(900) }, ["noResponse"])).toEqual(day(900));
  });
});

describe("getMemberRetentionClock", () => {
  test("uses the last sign-in", () => {
    expect(
      getMemberRetentionClock({ lastLoginAt: day(5), reactivatedAt: null }, membersPolicy, day(10))
    ).toEqual(day(5));
  });

  test("counts a member with no recorded sign-in from when the policy was switched on", () => {
    expect(
      getMemberRetentionClock({ lastLoginAt: null, reactivatedAt: null }, membersPolicy, day(10))
    ).toEqual(day(-1000));
    expect(
      getMemberRetentionClock({ lastLoginAt: null, reactivatedAt: null }, { enabledAt: null }, day(10))
    ).toEqual(day(10));
  });

  test("a reactivation restarts the clock without a sign-in", () => {
    expect(
      getMemberRetentionClock({ lastLoginAt: day(5), reactivatedAt: day(400) }, membersPolicy, day(401))
    ).toEqual(day(400));
    expect(
      getMemberRetentionClock({ lastLoginAt: null, reactivatedAt: day(400) }, membersPolicy, day(401))
    ).toEqual(day(400));
  });

  test("a sign-in after the reactivation still counts", () => {
    expect(
      getMemberRetentionClock({ lastLoginAt: day(500), reactivatedAt: day(400) }, membersPolicy, day(501))
    ).toEqual(day(500));
  });

  test("a reactivation voids the notice that led to the deactivation", () => {
    const clock = getMemberRetentionClock(
      { lastLoginAt: day(0), reactivatedAt: day(400) },
      membersPolicy,
      day(401)
    );

    expect(
      getRetentionSchedule(membersPolicy, target({ clock, noticeSentAt: day(305) }), day(401)).noticeSent
    ).toBe(false);
  });
});
