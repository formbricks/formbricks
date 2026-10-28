import { describe, expect, test } from "vitest";
import {
  describeConditions,
  describeDestination,
  describeDisplayStatus,
  describePositions,
  describePressOutcome,
  describeSchedule,
  describeShare,
  describeShowOn,
  formatInstant,
} from "./describe";
import type { TShowConditionGroupData } from "./model";
import { makeBanner, makeFeedbackButton } from "./test-creatives";

const format = { locale: "en-US", timeZone: "UTC" };

describe("describeDisplayStatus", () => {
  test("active", () => {
    expect(describeDisplayStatus(makeBanner())).toMatchObject({ label: "Active", tone: "success" });
  });

  test("scheduled names its start time in the host's time zone", () => {
    const creative = makeBanner({
      displayStatus: "scheduled",
      schedule: { startAt: "2026-11-01T09:30:00.000Z", endAt: null },
    });

    const status = describeDisplayStatus(creative, format);

    expect(status.label).toBe("Scheduled");
    expect(status.explanation).toBe("Published. Starts Nov 1, 2026, 9:30 AM.");
    expect(
      describeDisplayStatus(creative, { locale: "en-US", timeZone: "Asia/Tokyo" }).explanation
    ).toContain("6:30 PM");
  });

  test.each([
    ["surveyNotActive", "Paused with its survey"],
    ["destinationMissing", "needs a destination"],
    ["actionMissing", "has no action"],
    [null, "Paused by its author"],
  ] as const)("paused because of %s", (reason, expected) => {
    const status = describeDisplayStatus(
      makeBanner({ displayStatus: "paused", displayStatusReason: reason })
    );

    expect(status).toMatchObject({ label: "Paused", tone: "warning" });
    expect(status.explanation).toContain(expected);
  });

  test("paused with its survey names the survey", () => {
    const creative = makeFeedbackButton({
      displayStatus: "paused",
      displayStatusReason: "surveyNotActive",
      destination: { type: "survey", surveyId: "s1", surveyName: "Pricing", opensAs: "popup" },
    });

    expect(describeDisplayStatus(creative).explanation).toContain('"Pricing"');
  });

  test("closed by its schedule gives the end time, closed by its author does not", () => {
    const ended = makeBanner({
      displayStatus: "closed",
      displayStatusReason: "scheduleEnded",
      schedule: { startAt: null, endAt: "2026-10-12T08:00:00.000Z" },
    });

    expect(describeDisplayStatus(ended, format).explanation).toBe(
      "Its end time passed on Oct 12, 2026, 8:00 AM."
    );
    expect(describeDisplayStatus(makeBanner({ displayStatus: "closed" })).explanation).toBe(
      "Closed by its author, so it shows nowhere."
    );
  });

  test("draft and archived show nowhere", () => {
    expect(describeDisplayStatus(makeBanner({ displayStatus: "draft" })).explanation).toContain(
      "shows nowhere"
    );
    expect(describeDisplayStatus(makeBanner({ displayStatus: "archived" })).explanation).toContain(
      "read-only"
    );
  });
});

describe("describeShowOn", () => {
  test("page view", () => {
    expect(describeShowOn(makeBanner(), null)).toBe("On every page view");
  });

  const onAction = (count: number) =>
    makeBanner({
      distribution: {
        showOn: "action",
        triggers: Array.from({ length: count }, (_, index) => ({ actionClassId: `a${index}` })),
        conditions: null,
        displayPercentage: null,
      },
    });

  test("names the actions when it knows them", () => {
    expect(describeShowOn(onAction(1), ["Exit intent"])).toBe('When the action "Exit intent" fires');
    expect(describeShowOn(onAction(2), ["A", "B"])).toBe('When one of these actions fires: "A", "B"');
  });

  test("counts the actions when it does not, and says when there are none", () => {
    expect(describeShowOn(onAction(1), null)).toBe("When its action fires");
    expect(describeShowOn(onAction(3), null)).toBe("When one of its 3 actions fires");
    expect(describeShowOn(onAction(0), null)).toBe("When an action fires, but none is set");
  });
});

describe("describeShare", () => {
  test("everyone, or a share of visitors", () => {
    expect(describeShare(null)).toBe("Every visitor");
    expect(describeShare(25, format)).toBe("25% of visitors, decided once per visitor");
    expect(describeShare(0.125, format)).toContain("0.13%");
  });
});

describe("describeSchedule", () => {
  test("covers each combination of start and end", () => {
    expect(describeSchedule({ startAt: null, endAt: null })).toBe("No schedule: runs while published");
    expect(describeSchedule({ startAt: "2026-10-01T00:00:00.000Z", endAt: null }, format)).toBe(
      "From Oct 1, 2026, 12:00 AM, no end"
    );
    expect(describeSchedule({ startAt: null, endAt: "2026-10-01T00:00:00.000Z" }, format)).toBe(
      "Until Oct 1, 2026, 12:00 AM"
    );
    expect(
      describeSchedule({ startAt: "2026-10-01T00:00:00.000Z", endAt: "2026-10-02T00:00:00.000Z" }, format)
    ).toBe("Oct 1, 2026, 12:00 AM to Oct 2, 2026, 12:00 AM");
  });
});

describe("formatInstant", () => {
  test("uses the host's locale", () => {
    expect(formatInstant("2026-10-12T08:00:00.000Z", { locale: "de-DE", timeZone: "UTC" })).toContain(
      "12.10.2026"
    );
  });

  test("survives an unsupported locale or time zone, and returns text that is not a date as is", () => {
    expect(
      formatInstant("2026-10-12T08:00:00.000Z", { locale: "xx-invalid-locale-!", timeZone: "Nowhere/City" })
    ).toContain("2026");
    expect(formatInstant("soon")).toBe("soon");
  });
});

describe("describeConditions", () => {
  const condition = (
    id: string,
    type: string,
    value: string,
    operator: string,
    rightValue?: string | number | string[],
    key?: string
  ) => ({
    id,
    leftOperand: { type, value, ...(key ? { meta: { key } } : {}) },
    operator,
    ...(rightValue === undefined ? {} : { rightOperand: { type: "static", value: rightValue } }),
  });

  test("no conditions always pass", () => {
    expect(describeConditions(null)).toBeNull();
    expect(describeConditions({ id: "g", connector: "and", conditions: [] })).toBeNull();
  });

  test("one condition reads as a sentence", () => {
    const group: TShowConditionGroupData = {
      id: "g",
      connector: "and",
      conditions: [condition("c1", "page", "currentUrl", "startsWith", "https://example.com/pricing")],
    };

    expect(describeConditions(group)).toEqual({
      intro: "Only when",
      items: ['Current URL starts with "https://example.com/pricing"'],
    });
  });

  test("several conditions list one line each with the connector in the intro", () => {
    const group: TShowConditionGroupData = {
      id: "g",
      connector: "or",
      conditions: [
        condition("c1", "visit", "pagesViewed", "isGreaterThanOrEqual", 3),
        condition("c2", "page", "queryParam", "isSet", undefined, "utm_source"),
        condition("c3", "device", "deviceType", "doesNotEqual", "phone"),
      ],
    };

    expect(describeConditions(group)).toEqual({
      intro: "Only when any of these holds",
      items: [
        "Pages viewed is at least 3",
        'URL parameter "utm_source" is set',
        'Device type is not "phone"',
      ],
    });
  });

  test("a nested group is parenthesised with its own connector, and long lists are shortened", () => {
    const group: TShowConditionGroupData = {
      id: "g",
      connector: "and",
      conditions: [
        condition("c1", "page", "currentUrl", "pathIsAnyOf", ["/a", "/b", "/c", "/d", "/e", "/f", "/g"]),
        {
          id: "g2",
          connector: "or",
          conditions: [
            condition("c2", "device", "browser", "equals", "safari"),
            condition("c3", "device", "screenWidth", "isLessThan", 600),
          ],
        },
      ],
    };

    expect(describeConditions(group)?.items).toEqual([
      'Current URL is one of the paths "/a", "/b", "/c", "/d", "/e" and 2 more',
      '(Browser is "safari" or Window width in px is less than 600)',
    ]);
  });

  test("an operand or operator this view does not know is shown as it is", () => {
    const group: TShowConditionGroupData = {
      id: "g",
      connector: "and",
      conditions: [condition("c1", "device", "newThing", "newOperator", "x")],
    };

    expect(describeConditions(group)?.items).toEqual(['newThing newOperator "x"']);
  });
});

describe("describeDestination and describePressOutcome", () => {
  test("none", () => {
    expect(describeDestination(null)).toEqual({ summary: "None", detail: "Pressing it would open nothing." });
    expect(describePressOutcome(null)).toBe("pressing it would open nothing");
  });

  test("survey as a popup or in a new tab", () => {
    const popup = { type: "survey", surveyId: "s", surveyName: "Pricing", opensAs: "popup" } as const;
    const tab = { ...popup, opensAs: "newTab" } as const;

    expect(describeDestination(popup)).toEqual({
      summary: "Pricing",
      detail: "Opens the survey as a popup on the page.",
    });
    expect(describeDestination(tab).detail).toContain("new tab");
    expect(describePressOutcome(popup)).toBe('pressing it would open the survey "Pricing" as a popup');
    expect(describePressOutcome(tab)).toContain("in a new tab");
  });

  test("link", () => {
    const link = { type: "link", url: "https://example.com", opensAs: "newTab" } as const;

    expect(describeDestination(link)).toEqual({
      summary: "https://example.com",
      detail: "Opens the link in a new tab.",
    });
    expect(describePressOutcome(link)).toBe("pressing it would open https://example.com in a new tab");
  });
});

describe("describePositions", () => {
  test("a feedback button names its edge and offset, phones only when they differ", () => {
    const same = makeFeedbackButton({
      styling: { position: { desktop: { edge: "left", offset: 20 }, phone: { edge: "left", offset: 20 } } },
    });
    const different = makeFeedbackButton({
      styling: {
        position: { desktop: { edge: "right", offset: 50 }, phone: { edge: "bottom", offset: 80 } },
      },
    });

    expect(describePositions(same)).toEqual({ desktop: "Left edge, 20% from the top", phone: null });
    expect(describePositions(different)).toEqual({
      desktop: "Right edge, 50% from the top",
      phone: "Bottom edge, 80% from the left",
    });
  });

  test("a banner names its edge and layout", () => {
    const top = describePositions(makeBanner());
    const overlay = describePositions(
      makeBanner({
        styling: {
          position: {
            desktop: { placement: "top", layout: "overlay" },
            phone: { placement: "bottom", layout: "overlay" },
          },
        },
      })
    );

    expect(top.desktop).toBe("Top of the page, in the page flow (scrolls away)");
    expect(overlay).toEqual({
      desktop: "Top of the page, fixed over the content",
      phone: "Bottom of the page, fixed over the content",
    });
  });
});
