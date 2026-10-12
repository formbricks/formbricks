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
  periodDays: 365,
};

const responsesPolicy: TRetentionSchedulePolicy = {
  entity: "responses",
  enabledAt: day(-1000),
  warnDays: 30,
  periodDays: 730,
};

const membersPolicy: TRetentionSchedulePolicy = {
  entity: "members",
  enabledAt: day(-1000),
  warnDays: 60,
  periodDays: 365,
};

// A notice is claimed and delivered at the same moment unless a test says otherwise, and was computed
// for the default clock: a test that moves `clock` alone models activity since the notice.
const target = (overrides: Partial<TRetentionTargetState> = {}): TRetentionTargetState => ({
  clock: day(0),
  noticeClaimedAt: overrides.noticeDeliveredAt ?? null,
  noticeDeliveredAt: null,
  noticeClockAt: day(0),
  archivedAt: null,
  heldUntil: null,
  ...overrides,
});

describe("getRetentionSchedule", () => {
  test("plans the notice and the action from the clock when the notice goes out on time", () => {
    const schedule = getRetentionSchedule(surveysPolicy, target({ noticeDeliveredAt: day(335) }), day(340));

    expect(schedule).toEqual({
      warnAt: day(335),
      noticeAt: day(335),
      noticeSent: true,
      actionAt: day(365),
      // Archived on day 365, purged 30 days later.
      deleteAt: day(395),
    });
  });

  describe("the warning always runs in full", () => {
    test("a notice delivered late pushes the action back to a full warning after it", () => {
      const schedule = getRetentionSchedule(surveysPolicy, target({ noticeDeliveredAt: day(500) }), day(510));

      expect(schedule.actionAt).toEqual(day(530));
      expect(schedule.deleteAt).toEqual(day(560));
    });

    test("a notice that is overdue but not delivered is projected from now, not from the clock", () => {
      const schedule = getRetentionSchedule(surveysPolicy, target(), day(500));

      expect(schedule.noticeSent).toBe(false);
      expect(schedule.noticeAt).toEqual(day(500));
      expect(schedule.actionAt).toEqual(day(530));
    });

    test("nothing acts until a notice has been delivered, however old the clock", () => {
      expect(getDueRetentionStep(surveysPolicy, target(), day(5000))).toBe("notify");
      expect(
        getDueRetentionStep(surveysPolicy, target({ noticeDeliveredAt: day(4990) }), day(5000))
      ).toBeNull();
      expect(getDueRetentionStep(surveysPolicy, target({ noticeDeliveredAt: day(4970) }), day(5000))).toBe(
        "act"
      );
    });
  });

  describe("an archived survey is the purge's", () => {
    test("is purged a fixed 30 days after it was archived, by the policy or by hand", () => {
      const archived = target({ noticeDeliveredAt: day(335), archivedAt: day(400) });

      expect(getRetentionSchedule(surveysPolicy, archived, day(401))).toMatchObject({
        actionAt: day(400),
        deleteAt: day(430),
      });
      expect(getRetentionSchedule(surveysPolicy, target({ archivedAt: day(10) }), day(11)).deleteAt).toEqual(
        day(40)
      );
    });

    test("gets the full 30 days again from the end of an exemption that outlasted the archive", () => {
      // Matches the purge's own rule (`getSurveyPurgeEligibleWhere`): ending a hold never deletes at once.
      expect(
        getRetentionSchedule(surveysPolicy, target({ archivedAt: day(10), heldUntil: day(100) }), day(101))
          .deleteAt
      ).toEqual(day(130));
      // An exemption that ended before the archive changes nothing.
      expect(
        getRetentionSchedule(surveysPolicy, target({ archivedAt: day(10), heldUntil: day(5) }), day(11))
          .deleteAt
      ).toEqual(day(40));
    });

    test("leaves the policy nothing to do", () => {
      expect(getDueRetentionStep(surveysPolicy, target({ archivedAt: day(10) }), day(9000))).toBeNull();
    });
  });

  describe("a clock reset voids the notice", () => {
    test("a notice computed for an earlier clock no longer counts", () => {
      const reset = target({ clock: day(400), noticeDeliveredAt: day(335) });
      const schedule = getRetentionSchedule(surveysPolicy, reset, day(401));

      expect(schedule.noticeSent).toBe(false);
      expect(schedule.warnAt).toEqual(day(735));
      expect(schedule.actionAt).toEqual(day(765));
      expect(getDueRetentionStep(surveysPolicy, reset, day(401))).toBeNull();
      expect(getDueRetentionStep(surveysPolicy, reset, day(765))).toBe("notify");
    });

    test("a notice delivered at the same instant as the clock still counts", () => {
      expect(
        getRetentionSchedule(surveysPolicy, target({ noticeDeliveredAt: day(0) }), day(1)).noticeSent
      ).toBe(true);
    });

    test("activity between the sweep's read and its claim voids the notice it claimed", () => {
      // Read at day 334 with the clock at day 0; the survey changed on day 335 (clock moves); the notice
      // was claimed on day 336 with the dates of the old clock. Claimed after the new clock, but computed
      // for the old one: it states a date that will never come, so it doesn't count.
      const raced = target({
        clock: day(335),
        noticeClockAt: day(0),
        noticeClaimedAt: day(336),
        noticeDeliveredAt: day(336),
      });

      expect(getRetentionSchedule(surveysPolicy, raced, day(400)).noticeSent).toBe(false);
      expect(getDueRetentionStep(surveysPolicy, raced, day(1000))).toBe("notify");
      expect(getDueRetentionStep(membersPolicy, raced, day(1000))).toBe("notify");
    });

    test("a notice computed for the current clock counts, whenever the clock last moved", () => {
      const current = target({ clock: day(335), noticeClockAt: day(335), noticeDeliveredAt: day(670) });

      expect(getRetentionSchedule(surveysPolicy, current, day(671)).noticeSent).toBe(true);
      expect(getDueRetentionStep(surveysPolicy, current, day(700))).toBe("act");
    });

    test("a clock-bound notice with no clock on record doesn't count", () => {
      expect(
        getRetentionSchedule(
          surveysPolicy,
          target({ noticeClockAt: null, noticeDeliveredAt: day(335) }),
          day(400)
        ).noticeSent
      ).toBe(false);
    });
  });

  describe("a policy switched on, unpaused or tightened voids older notices (ENG-3614)", () => {
    // Paused after the notice went out, unpaused much later: the clock never moved, so without this
    // rule the old notice would act on the target the night the policy is unpaused.
    const unpaused = { ...surveysPolicy, enabledAt: day(800) };

    test("a notice delivered before the policy took effect no longer counts", () => {
      const schedule = getRetentionSchedule(unpaused, target({ noticeDeliveredAt: day(335) }), day(801));

      expect(schedule.noticeSent).toBe(false);
      expect(schedule.actionAt).toEqual(day(831));
    });

    test("the next cycle sends a new notice and acts only after a full warning", () => {
      expect(getDueRetentionStep(unpaused, target({ noticeDeliveredAt: day(335) }), day(801))).toBe("notify");
      expect(getDueRetentionStep(unpaused, target({ noticeDeliveredAt: day(801) }), day(830))).toBeNull();
      expect(getDueRetentionStep(unpaused, target({ noticeDeliveredAt: day(801) }), day(831))).toBe("act");
    });
  });

  describe("a notice counts from its claim and its delivery", () => {
    test("a claim that was never delivered doesn't count", () => {
      expect(
        getDueRetentionStep(
          surveysPolicy,
          target({ noticeClaimedAt: day(335), noticeDeliveredAt: null }),
          day(400)
        )
      ).toBe("notify");
    });

    test("a notice claimed before a tightening is void, even if delivered after it", () => {
      // Claimed under the old settings at day 335 (its email carries the old date), the policy was
      // tightened at day 336, and the email only went out at day 337.
      const tightened = { ...surveysPolicy, enabledAt: day(336) };
      const late = target({ noticeClaimedAt: day(335), noticeDeliveredAt: day(337) });

      expect(getRetentionSchedule(tightened, late, day(338)).noticeSent).toBe(false);
      expect(getDueRetentionStep(tightened, late, day(338))).toBe("notify");
    });

    test("the warning runs from delivery, not from the claim", () => {
      const slow = target({ noticeClaimedAt: day(335), noticeDeliveredAt: day(340) });

      expect(getRetentionSchedule(surveysPolicy, slow, day(341)).actionAt).toEqual(day(370));
    });

    test("a notice claimed before the clock moved is void, even if delivered after it", () => {
      const moved = target({ clock: day(337), noticeClaimedAt: day(336), noticeDeliveredAt: day(338) });

      expect(getDueRetentionStep(surveysPolicy, moved, day(1000))).toBe("notify");
    });

    test("a notice claimed before an exemption ended is void, even if delivered after it", () => {
      const held = target({ noticeClaimedAt: day(599), noticeDeliveredAt: day(601), heldUntil: day(600) });

      expect(getDueRetentionStep(surveysPolicy, held, day(1000))).toBe("notify");
    });

    test("a policy with no recorded switch-on time accepts no earlier notice", () => {
      const off = { ...surveysPolicy, enabledAt: null };

      expect(getRetentionSchedule(off, target({ noticeDeliveredAt: day(335) }), day(400)).noticeSent).toBe(
        false
      );
    });

    test("a notice from before an exemption ended is void", () => {
      const held = target({ noticeDeliveredAt: day(335), heldUntil: day(600) });

      expect(getRetentionSchedule(surveysPolicy, held, day(601)).noticeSent).toBe(false);
      expect(getDueRetentionStep(surveysPolicy, held, day(601))).toBe("notify");
      expect(
        getDueRetentionStep(
          surveysPolicy,
          target({ noticeDeliveredAt: day(601), heldUntil: day(600) }),
          day(631)
        )
      ).toBe("act");
    });
  });

  describe("the responses reminder, sent once per survey", () => {
    test("the first deletion waits a full warning after the reminder", () => {
      const policy = { ...responsesPolicy, enabledAt: day(1000) };

      expect(getDueRetentionStep(policy, target(), day(1000))).toBe("notify");
      expect(getDueRetentionStep(policy, target({ noticeDeliveredAt: day(1000) }), day(1029))).toBeNull();
      expect(getDueRetentionStep(policy, target({ noticeDeliveredAt: day(1000) }), day(1030))).toBe("act");
    });

    test("later responses need no new reminder: newer clocks don't void it", () => {
      const later = target({ clock: day(500), noticeClockAt: null, noticeDeliveredAt: day(400) });
      const schedule = getRetentionSchedule(responsesPolicy, later, day(1300));

      expect(schedule.noticeSent).toBe(true);
      expect(schedule.actionAt).toEqual(day(1230));
      expect(getDueRetentionStep(responsesPolicy, later, day(1230))).toBe("act");
    });

    test("a policy change voids it, so the next deletion waits for a new reminder", () => {
      const tightened = { ...responsesPolicy, enabledAt: day(1200) };

      expect(getDueRetentionStep(tightened, target({ noticeDeliveredAt: day(400) }), day(1300))).toBe(
        "notify"
      );
    });
  });

  test("members are deactivated after their notice, and nothing is deleted", () => {
    expect(getDueRetentionStep(membersPolicy, target(), day(305))).toBe("notify");
    expect(getDueRetentionStep(membersPolicy, target({ noticeDeliveredAt: day(305) }), day(364))).toBeNull();
    expect(getDueRetentionStep(membersPolicy, target({ noticeDeliveredAt: day(305) }), day(365))).toBe("act");
    expect(
      getRetentionSchedule(membersPolicy, target({ noticeDeliveredAt: day(305) }), day(365)).deleteAt
    ).toBeNull();
  });

  test("responses are deleted when the policy acts", () => {
    const schedule = getRetentionSchedule(responsesPolicy, target({ noticeDeliveredAt: day(700) }), day(701));

    expect(schedule.actionAt).toEqual(day(730));
    expect(schedule.deleteAt).toEqual(day(730));
  });

  test("a policy that is off is planned as if it were switched on now", () => {
    const off = { ...surveysPolicy, enabledAt: null };

    expect(getRetentionSchedule(off, target(), day(2000)).actionAt).toEqual(day(2030));
  });

  test("the shortest allowed policy still runs its notice in full before acting", () => {
    const shortest = { ...surveysPolicy, warnDays: 14, periodDays: 30 };

    expect(getDueRetentionStep(shortest, target(), day(15))).toBeNull();
    expect(getDueRetentionStep(shortest, target(), day(16))).toBe("notify");
    expect(getDueRetentionStep(shortest, target({ noticeDeliveredAt: day(16) }), day(29))).toBeNull();
    expect(getDueRetentionStep(shortest, target({ noticeDeliveredAt: day(16) }), day(30))).toBe("act");
  });
});

describe("getRetentionClockCutoffs", () => {
  test.each([surveysPolicy, responsesPolicy, membersPolicy])(
    "selects nothing for action until a notice can have run, for $entity",
    (policy) => {
      const recent = { ...policy, enabledAt: day(1000) };
      const cutoff = (now: Date) => getRetentionClockCutoffs(recent, now).actionDueAtOrBefore;

      expect(cutoff(addRetentionDays(day(1000), policy.warnDays - 1))).toBeNull();
      expect(cutoff(addRetentionDays(day(1000), policy.warnDays))).not.toBeNull();
      expect(
        getRetentionClockCutoffs({ ...policy, enabledAt: null }, day(1000)).actionDueAtOrBefore
      ).toBeNull();
    }
  );

  // The sweep's SQL selects with these bounds and re-checks each row with getDueRetentionStep, so the
  // two must agree exactly at the boundary: a clock on the cutoff is due, one millisecond later isn't.
  const justAfter = (date: Date) => new Date(date.getTime() + 1);
  const policies = [surveysPolicy, responsesPolicy, membersPolicy];

  test.each(policies)("agrees with the notice step for $entity", (policy) => {
    const now = day(5000);
    const { noticeDueAtOrBefore } = getRetentionClockCutoffs(policy, now);

    expect(getDueRetentionStep(policy, target({ clock: noticeDueAtOrBefore }), now)).toBe("notify");
    expect(getDueRetentionStep(policy, target({ clock: justAfter(noticeDueAtOrBefore) }), now)).toBeNull();
  });

  test.each(policies)("agrees with the action for $entity once the notice has run", (policy) => {
    const now = day(5000);
    const { actionDueAtOrBefore } = getRetentionClockCutoffs(policy, now);
    const noticeDeliveredAt = addRetentionDays(now, -policy.warnDays);
    if (!actionDueAtOrBefore) throw new Error("expected a cutoff");

    // A notice computed for the clock it is tested with.
    const at = (clock: Date) => target({ clock, noticeClockAt: clock, noticeDeliveredAt });

    expect(getDueRetentionStep(policy, at(actionDueAtOrBefore), now)).toBe("act");
    expect(getDueRetentionStep(policy, at(justAfter(actionDueAtOrBefore)), now)).toBeNull();
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
      getMemberRetentionClock(
        { lastLoginAt: day(5), lastActiveAt: null, reactivatedAt: null },
        membersPolicy,
        day(10)
      )
    ).toEqual(day(5));
  });

  test("counts a member with no recorded sign-in from when the policy was switched on", () => {
    expect(
      getMemberRetentionClock(
        { lastLoginAt: null, lastActiveAt: null, reactivatedAt: null },
        membersPolicy,
        day(10)
      )
    ).toEqual(day(-1000));
    expect(
      getMemberRetentionClock(
        { lastLoginAt: null, lastActiveAt: null, reactivatedAt: null },
        { enabledAt: null },
        day(10)
      )
    ).toEqual(day(10));
  });

  test("a reactivation restarts the clock without a sign-in", () => {
    expect(
      getMemberRetentionClock(
        { lastLoginAt: day(5), lastActiveAt: null, reactivatedAt: day(400) },
        membersPolicy,
        day(401)
      )
    ).toEqual(day(400));
    expect(
      getMemberRetentionClock(
        { lastLoginAt: null, lastActiveAt: null, reactivatedAt: day(400) },
        membersPolicy,
        day(401)
      )
    ).toEqual(day(400));
  });

  test("activity recorded after the last sign-in (a session renewal) counts", () => {
    expect(
      getMemberRetentionClock(
        { lastLoginAt: day(5), lastActiveAt: day(300), reactivatedAt: null },
        membersPolicy,
        day(301)
      )
    ).toEqual(day(300));
    // Older activity changes nothing.
    expect(
      getMemberRetentionClock(
        { lastLoginAt: day(5), lastActiveAt: day(2), reactivatedAt: null },
        membersPolicy,
        day(301)
      )
    ).toEqual(day(5));
  });

  test("activity counts even for a member with no sign-in on record, beyond the policy's start", () => {
    expect(
      getMemberRetentionClock(
        { lastLoginAt: null, lastActiveAt: day(300), reactivatedAt: null },
        membersPolicy,
        day(301)
      )
    ).toEqual(day(300));
  });

  test("a sign-in after the reactivation still counts", () => {
    expect(
      getMemberRetentionClock(
        { lastLoginAt: day(500), lastActiveAt: null, reactivatedAt: day(400) },
        membersPolicy,
        day(501)
      )
    ).toEqual(day(500));
  });

  test("a reactivation voids the notice that led to the deactivation", () => {
    const clock = getMemberRetentionClock(
      { lastLoginAt: day(0), lastActiveAt: null, reactivatedAt: day(400) },
      membersPolicy,
      day(401)
    );

    expect(
      getRetentionSchedule(membersPolicy, target({ clock, noticeDeliveredAt: day(305) }), day(401)).noticeSent
    ).toBe(false);
  });
});
