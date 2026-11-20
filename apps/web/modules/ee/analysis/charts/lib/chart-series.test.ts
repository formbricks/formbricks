import { describe, expect, test } from "vitest";
import {
  EMPTY_GROUP_VALUE,
  applyEmptyValueSetting,
  assignSeriesColors,
  buildGroupedSeries,
  canStackSeries,
  collapseEmptyGroupRows,
  getChartGrouping,
  getStackedBarRadius,
  hasStackableSeries,
  orderGroupCombos,
  orderGroupValues,
  prepareGroupedRows,
  sortCategoryRows,
  stripSharedLabelPrefix,
} from "./chart-series";

const WEEK = "FeedbackRecords.collectedAt.week";
const SOURCE = "FeedbackRecords.sourceName";
const SENTIMENT = "FeedbackRecords.sentiment";
const COUNT = "FeedbackRecords.count";
const NPS = "FeedbackRecords.npsScore";

describe("applyEmptyValueSetting", () => {
  const rows = [
    { [SOURCE]: "Email", [COUNT]: 3 },
    { [SOURCE]: null, [COUNT]: 2 },
    { [SOURCE]: "  ", [COUNT]: 1 },
  ];

  test("hides empty groups by default", () => {
    expect(applyEmptyValueSetting(rows, [SOURCE], false)).toEqual([{ [SOURCE]: "Email", [COUNT]: 3 }]);
  });

  test("keeps empty groups under a stable key when shown", () => {
    const shown = applyEmptyValueSetting(rows, [SOURCE], true);
    expect(shown.map((row) => row[SOURCE])).toEqual(["Email", EMPTY_GROUP_VALUE, EMPTY_GROUP_VALUE]);
    expect(rows[1][SOURCE]).toBeNull();
  });

  test("leaves rows alone when nothing is grouped", () => {
    expect(applyEmptyValueSetting(rows, [], false)).toBe(rows);
  });
});

describe("orderGroupValues", () => {
  const noWeight = () => 0;

  test("sentiment follows its scale, empty last", () => {
    expect(
      orderGroupValues(["positive", EMPTY_GROUP_VALUE, "negative", "mixed"], SENTIMENT, noWeight)
    ).toEqual(["negative", "positive", "mixed", EMPTY_GROUP_VALUE]);
  });

  test("choice answers follow survey order", () => {
    const optionLabels = { a: "Very dissatisfied", b: "Neutral", c: "Very satisfied" };
    expect(orderGroupValues(["c", "a", "b"], "FeedbackRecords.valueId", noWeight, optionLabels)).toEqual([
      "a",
      "b",
      "c",
    ]);
  });

  test("answer text follows survey order too, unknown answers after", () => {
    const optionLabels = { a: "Very dissatisfied", b: "Neutral", c: "Very satisfied" };
    const weights: Record<string, number> = {
      "Very satisfied": 1,
      Neutral: 9,
      "Very dissatisfied": 2,
      Sehr: 5,
    };
    expect(
      orderGroupValues(
        ["Very satisfied", "Sehr", "Neutral", "Very dissatisfied"],
        "FeedbackRecords.valueText",
        (v) => weights[v],
        optionLabels
      )
    ).toEqual(["Very dissatisfied", "Neutral", "Very satisfied", "Sehr"]);
  });

  test("numeric groupings run low to high", () => {
    expect(orderGroupValues(["10", "2", "7"], "FeedbackRecords.valueNumber", noWeight)).toEqual([
      "2",
      "7",
      "10",
    ]);
  });

  test("everything else goes largest first", () => {
    const weights: Record<string, number> = { A: 1, B: 5, C: 3 };
    expect(orderGroupValues(["A", "B", "C"], SOURCE, (v) => weights[v])).toEqual(["B", "C", "A"]);
  });
});

describe("sortCategoryRows", () => {
  test("orders a plain category axis by size", () => {
    const rows = [
      { [SOURCE]: "A", [COUNT]: 1 },
      { [SOURCE]: "B", [COUNT]: 9 },
    ];
    expect(sortCategoryRows(rows, SOURCE, COUNT).map((r) => r[SOURCE])).toEqual(["B", "A"]);
  });
});

describe("buildGroupedSeries", () => {
  const groupOrder = (values: string[][], weight: (v: string[]) => number) =>
    [...values].sort((a, b) => weight(b) - weight(a));

  test("pivots time × group into one row per bucket and one series per group", () => {
    const rows = [
      { [WEEK]: "2026-11-02", [SOURCE]: "Email", [COUNT]: 2 },
      { [WEEK]: "2026-11-02", [SOURCE]: "Web", [COUNT]: 5 },
      { [WEEK]: "2026-11-09", [SOURCE]: "Web", [COUNT]: 1 },
    ];
    const result = buildGroupedSeries({
      rows,
      categoryKey: WEEK,
      groupKeys: [SOURCE],
      measureKeys: [COUNT],
      groupOrder,
    });
    expect(result.series.map((s) => s.groupValues)).toEqual([["Web"], ["Email"]]);
    const [web, email] = result.series.map((s) => s.key);
    expect(result.rows).toEqual([
      { [WEEK]: "2026-11-02", [web]: 5, [email]: 2 },
      // Email had no records that week: a count of 0.
      { [WEEK]: "2026-11-09", [web]: 1, [email]: 0 },
    ]);
  });

  test("a ratio with no records in a bucket is a gap, not zero", () => {
    const rows = [
      { [WEEK]: "w1", [SOURCE]: "Email", [NPS]: 10 },
      { [WEEK]: "w2", [SOURCE]: "Web", [NPS]: -5 },
    ];
    const result = buildGroupedSeries({
      rows,
      categoryKey: WEEK,
      groupKeys: [SOURCE],
      measureKeys: [NPS],
      groupOrder: (v) => v,
    });
    const [email, web] = result.series.map((s) => s.key);
    expect(result.rows[0][web]).toBeNull();
    expect(result.rows[1][email]).toBeNull();
  });

  test("draws every group, with no cap", () => {
    const rows = Array.from({ length: 40 }, (_, i) => ({ [WEEK]: "w1", [SOURCE]: `S${i}`, [COUNT]: i }));
    const result = buildGroupedSeries({
      rows,
      categoryKey: WEEK,
      groupKeys: [SOURCE],
      measureKeys: [COUNT],
      groupOrder,
    });
    expect(result.series).toHaveLength(40);
  });
});

describe("stripSharedLabelPrefix", () => {
  test("drops a prefix every label shares", () => {
    expect(stripSharedLabelPrefix(["NPS: Promoters", "NPS: Passives", "NPS: Detractors"])).toEqual([
      "Promoters",
      "Passives",
      "Detractors",
    ]);
  });

  test("keeps labels when prefixes differ or there is one label", () => {
    expect(stripSharedLabelPrefix(["NPS: Score", "CSAT: Score"])).toEqual(["NPS: Score", "CSAT: Score"]);
    expect(stripSharedLabelPrefix(["NPS: Score"])).toEqual(["NPS: Score"]);
    expect(stripSharedLabelPrefix(["Emotion: Joy", "Count"])).toEqual(["Emotion: Joy", "Count"]);
  });

  test("handles a French-style space before the colon", () => {
    expect(stripSharedLabelPrefix(["Émotion : Joie", "Émotion : Peur"])).toEqual(["Joie", "Peur"]);
  });
});

describe("canStackSeries", () => {
  test("only counts stack", () => {
    expect(canStackSeries([COUNT, "FeedbackRecords.promoterCount"])).toBe(true);
    expect(canStackSeries([NPS])).toBe(false);
    expect(canStackSeries([])).toBe(false);
  });
});

describe("getChartGrouping", () => {
  test("time takes the axis and every grouping becomes a series", () => {
    const grouping = getChartGrouping({
      measures: [COUNT],
      dimensions: [SOURCE],
      timeDimensions: [{ dimension: "FeedbackRecords.collectedAt", granularity: "week" }],
    });
    expect(grouping).toEqual({
      categoryKey: WEEK,
      isTimeCategory: true,
      groupKeys: [SOURCE],
      dimensionKeys: [SOURCE],
    });
  });

  test("without time the first grouping is the axis and the second the series", () => {
    expect(getChartGrouping({ measures: [COUNT], dimensions: [SOURCE, SENTIMENT] })).toMatchObject({
      categoryKey: SOURCE,
      isTimeCategory: false,
      groupKeys: [SENTIMENT],
    });
  });

  test("a date range without granularity is not a grouping", () => {
    expect(
      getChartGrouping({
        measures: [COUNT],
        timeDimensions: [{ dimension: "FeedbackRecords.collectedAt", dateRange: "last 7 days" }],
      }).categoryKey
    ).toBeUndefined();
  });
});

describe("hasStackableSeries", () => {
  test("needs several count series on a category axis", () => {
    expect(hasStackableSeries({ measures: [COUNT], dimensions: [SOURCE, SENTIMENT] })).toBe(true);
    expect(hasStackableSeries({ measures: [COUNT], dimensions: [SOURCE] })).toBe(false);
    expect(hasStackableSeries({ measures: [NPS], dimensions: [SOURCE, SENTIMENT] })).toBe(false);
    expect(hasStackableSeries({ measures: [COUNT, "FeedbackRecords.promoterCount"] })).toBe(false);
  });
});

describe("assignSeriesColors", () => {
  test("semantic colors stay, palette goes only to the rest", () => {
    expect(assignSeriesColors(["#red", undefined, undefined], ["#a", "#b"])).toEqual(["#red", "#a", "#b"]);
  });
});

describe("getStackedBarRadius", () => {
  test("rounds only the outer segment, on the side it points to", () => {
    expect(getStackedBarRadius(false, false)).toEqual([0, 0, 0, 0]);
    expect(getStackedBarRadius(true, false)).toEqual([4, 4, 0, 0]);
    expect(getStackedBarRadius(true, true)).toEqual([0, 4, 4, 0]);
  });
});

describe("orderGroupCombos", () => {
  test("one grouping follows its natural order", () => {
    expect(orderGroupCombos([["positive"], ["very_negative"]], [SENTIMENT], () => 0)).toEqual([
      ["very_negative"],
      ["positive"],
    ]);
  });

  test("several groupings go largest first", () => {
    const weights: Record<string, number> = { '["a","x"]': 1, '["b","y"]': 9 };
    expect(
      orderGroupCombos(
        [
          ["a", "x"],
          ["b", "y"],
        ],
        [SOURCE, SENTIMENT],
        (v) => weights[JSON.stringify(v)]
      )
    ).toEqual([
      ["b", "y"],
      ["a", "x"],
    ]);
  });
});

describe("empty groups that merge", () => {
  test("a null and a blank value become one shown group, counts added", () => {
    const shown = applyEmptyValueSetting(
      [
        { [SOURCE]: null, [COUNT]: 2 },
        { [SOURCE]: " ", [COUNT]: 1 },
        { [SOURCE]: "Web", [COUNT]: 5 },
      ],
      [SOURCE],
      true
    );
    expect(collapseEmptyGroupRows(shown, [SOURCE], [COUNT])).toEqual([
      { [SOURCE]: EMPTY_GROUP_VALUE, [COUNT]: 3 },
      { [SOURCE]: "Web", [COUNT]: 5 },
    ]);
  });

  test("the grouped pivot keeps both rows' counts in one cell", () => {
    const rows = applyEmptyValueSetting(
      [
        { [WEEK]: "w1", [SOURCE]: null, [COUNT]: 2 },
        { [WEEK]: "w1", [SOURCE]: "", [COUNT]: 1 },
      ],
      [SOURCE],
      true
    );
    const result = buildGroupedSeries({
      rows,
      categoryKey: WEEK,
      groupKeys: [SOURCE],
      measureKeys: [COUNT],
      groupOrder: (v) => v,
    });
    expect(result.rows[0][result.series[0].key]).toBe(3);
  });

  test("a ratio is re-weighted by its response base, never added up", () => {
    const NPS_COUNT = "FeedbackRecords.npsCount";
    const shown = applyEmptyValueSetting(
      [
        { [SOURCE]: null, [NPS]: 10, [NPS_COUNT]: 1 },
        { [SOURCE]: "", [NPS]: 30, [NPS_COUNT]: 3 },
      ],
      [SOURCE],
      true
    );
    expect(collapseEmptyGroupRows(shown, [SOURCE], [NPS])).toEqual([
      { [SOURCE]: EMPTY_GROUP_VALUE, [NPS]: 25, [NPS_COUNT]: 4 },
    ]);
  });

  test("a matrix cell (two groupings) folds a shown empty group's score by its base", () => {
    const NPS_COUNT = "FeedbackRecords.npsCount";
    const COLUMN = "FeedbackRecords.sentiment";
    const rows = [
      { [SOURCE]: null, [COLUMN]: "positive", [NPS]: 100, [NPS_COUNT]: 1 },
      { [SOURCE]: "", [COLUMN]: "positive", [NPS]: -100, [NPS_COUNT]: 9 },
      { [SOURCE]: "web", [COLUMN]: "positive", [NPS]: 50, [NPS_COUNT]: 2 },
    ];
    expect(prepareGroupedRows(rows, [SOURCE, COLUMN], [NPS], true)).toEqual([
      { [SOURCE]: EMPTY_GROUP_VALUE, [COLUMN]: "positive", [NPS]: -80, [NPS_COUNT]: 10 },
      { [SOURCE]: "web", [COLUMN]: "positive", [NPS]: 50, [NPS_COUNT]: 2 },
    ]);
    expect(prepareGroupedRows(rows, [SOURCE, COLUMN], [NPS], false)).toEqual([rows[2]]);
  });

  test("a ratio without a base cannot be recomputed and becomes a gap", () => {
    const shown = applyEmptyValueSetting(
      [
        { [SOURCE]: null, [NPS]: 10 },
        { [SOURCE]: "", [NPS]: 30 },
      ],
      [SOURCE],
      true
    );
    expect(collapseEmptyGroupRows(shown, [SOURCE], [NPS])).toEqual([
      { [SOURCE]: EMPTY_GROUP_VALUE, [NPS]: null },
    ]);
  });

  test("empty groups of different weeks stay apart", () => {
    const shown = applyEmptyValueSetting(
      [
        { [WEEK]: "w1", [SOURCE]: null, [COUNT]: 2 },
        { [WEEK]: "w2", [SOURCE]: "", [COUNT]: 1 },
        { [WEEK]: "w2", [SOURCE]: null, [COUNT]: 4 },
      ],
      [SOURCE],
      true
    );
    expect(collapseEmptyGroupRows(shown, [SOURCE], [COUNT])).toEqual([
      { [WEEK]: "w1", [SOURCE]: EMPTY_GROUP_VALUE, [COUNT]: 2 },
      { [WEEK]: "w2", [SOURCE]: EMPTY_GROUP_VALUE, [COUNT]: 5 },
    ]);
  });
});

describe("a ratio over three empty groups", () => {
  const rowsOf = (values: { nps: number; count?: number }[]) =>
    applyEmptyValueSetting(
      values.map((v, i) => ({
        [SOURCE]: i % 2 === 0 ? null : "",
        [NPS]: v.nps,
        ...(v.count === undefined ? {} : { "FeedbackRecords.npsCount": v.count }),
      })),
      [SOURCE],
      true
    );

  test("without bases the merge stays a gap, whatever the order", () => {
    const merged = collapseEmptyGroupRows(rowsOf([{ nps: 10 }, { nps: 30 }, { nps: 50 }]), [SOURCE], [NPS]);
    expect(merged).toHaveLength(1);
    expect(merged[0][NPS]).toBeNull();
  });

  test("with bases every row is weighed together", () => {
    const merged = collapseEmptyGroupRows(
      rowsOf([
        { nps: 10, count: 1 },
        { nps: 30, count: 1 },
        { nps: 50, count: 2 },
      ]),
      [SOURCE],
      [NPS]
    );
    expect(merged[0][NPS]).toBe(35);
    expect(merged[0]["FeedbackRecords.npsCount"]).toBe(4);
  });
});
