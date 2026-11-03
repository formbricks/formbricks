import { describe, expect, test } from "vitest";
import {
  getMatrixLookup as sharedGetMatrixLookup,
  withMatrixConditionIds as sharedWithMatrixConditionIds,
  withMatrixConditionIdsInBlocks as sharedWithMatrixConditionIdsInBlocks,
} from "@formbricks/types/surveys/matrix-conditions";
import { planQuotaMatrixIds, planSurveyMatrixIds, syncBlocks } from "./utils";

const grid = {
  id: "grid",
  type: "matrix",
  rows: [
    { id: "row_netflix", label: { default: "Netflix" } },
    { id: "row_disney", label: { default: "Disney+" } },
  ],
  columns: [
    { id: "col_poor", label: { default: "Poor" } },
    { id: "col_good", label: { default: "Good" } },
  ],
};

const condition = (meta: Record<string, string>, rightOperand?: Record<string, unknown>) => ({
  id: "cond",
  leftOperand: { type: "element", value: "grid", meta },
  operator: rightOperand ? "equals" : "isNotEmpty",
  ...(rightOperand && { rightOperand: { type: "static", ...rightOperand } }),
});

const group = (...conditions: unknown[]) => ({ id: "group", connector: "and", conditions });

const blocksWith = (logicConditions: unknown, showIf?: unknown) => [
  {
    id: "b1",
    name: "Ratings",
    elements: [grid, { id: "why", type: "openText", ...(showIf ? { showIf } : {}) }],
    logic: [{ id: "rule", conditions: logicConditions, actions: [] }],
  },
];

const surveyRow = (blocks: unknown) => ({ id: "srv_1", updatedAt: "2026-01-01 00:00:00.000", blocks });

describe("planSurveyMatrixIds", () => {
  test("adds the row and column ids next to the positions, which stay", () => {
    const plan = planSurveyMatrixIds(surveyRow(blocksWith(group(condition({ row: "1" }, { value: "0" })))));

    expect(plan).toMatchObject({
      status: "update",
      value: [
        {
          logic: [
            {
              conditions: {
                conditions: [
                  {
                    leftOperand: { meta: { row: "1", rowId: "row_disney" } },
                    rightOperand: { value: "0", columnId: "col_poor" },
                  },
                ],
              },
            },
          ],
        },
      ],
    });
  });

  test("covers nested groups, isAnyOf lists and show-if", () => {
    const nested = group(group(condition({ row: "0" }, { value: ["1", "0"] })));
    const plan = planSurveyMatrixIds(surveyRow(blocksWith(nested, group(condition({ row: "1" })))));
    const [block] = (plan as { value: Record<string, never>[] }).value as unknown as {
      logic: { conditions: { conditions: { conditions: unknown[] }[] } }[];
      elements: { showIf?: { conditions: unknown[] } }[];
    }[];

    expect(block.logic[0].conditions.conditions[0].conditions[0]).toMatchObject({
      leftOperand: { meta: { row: "0", rowId: "row_netflix" } },
      rightOperand: { value: ["1", "0"], columnIds: ["col_good", "col_poor"] },
    });
    expect(block.elements[1].showIf?.conditions[0]).toMatchObject({
      leftOperand: { meta: { row: "1", rowId: "row_disney" } },
    });
  });

  test("a re-run over its own output changes nothing", () => {
    const first = planSurveyMatrixIds(surveyRow(blocksWith(group(condition({ row: "1" }, { value: "0" })))));
    const again = planSurveyMatrixIds(surveyRow((first as { value: unknown }).value));

    expect(again).toEqual({ status: "unchanged" });
  });

  test("leaves a position out of range, and a whole-matrix condition, as they are", () => {
    const outOfRange = group(condition({ row: "5" }, { value: "9" }));
    const wholeMatrix = group({
      id: "c",
      leftOperand: { type: "element", value: "grid" },
      operator: "isSkipped",
    });

    expect(planSurveyMatrixIds(surveyRow(blocksWith(outOfRange)))).toEqual({ status: "unchanged" });
    expect(planSurveyMatrixIds(surveyRow(blocksWith(wholeMatrix)))).toEqual({ status: "unchanged" });
  });

  test("tolerates malformed stored data", () => {
    expect(planSurveyMatrixIds(surveyRow(null))).toEqual({ status: "unchanged" });
    expect(planSurveyMatrixIds(surveyRow([null, { elements: "x" }, { logic: [null] }]))).toEqual({
      status: "unchanged",
    });
  });
});

describe("planQuotaMatrixIds", () => {
  test("adds the ids to a quota's conditions, reading the matrix from its survey", () => {
    const plan = planQuotaMatrixIds({
      id: "quota_1",
      updatedAt: "2026-01-01 00:00:00.000",
      logic: { connector: "and", conditions: [condition({ row: "0" }, { value: "1" })] },
      blocks: blocksWith(group()),
    });

    expect(plan).toEqual({
      status: "update",
      value: {
        connector: "and",
        conditions: [
          {
            ...condition({ row: "0", rowId: "row_netflix" }, { value: "1", columnId: "col_good" }),
          },
        ],
      },
    });
  });

  test("a quota on a survey without that matrix is left alone", () => {
    const logic = { connector: "and", conditions: [condition({ row: "0" }, { value: "1" })] };

    expect(planQuotaMatrixIds({ id: "q", updatedAt: "", logic, blocks: [] })).toEqual({
      status: "unchanged",
    });
  });
});

/**
 * The planner is a frozen copy of the write path's sync (`withMatrixConditionIds`). While this
 * migration is unreleased, the two must agree on every fixture.
 */
describe("the planner and the write path agree", () => {
  const fixtures: [string, unknown][] = [
    ["positions only", group(condition({ row: "1" }, { value: "0" }))],
    ["an isAnyOf list", group(condition({ row: "0" }, { value: ["0", "1"] }))],
    [
      "ids that disagree with positions",
      group(condition({ row: "0", rowId: "row_disney" }, { value: "0", columnId: "col_good" })),
    ],
    [
      "an unknown id",
      group(condition({ row: "0", rowId: "row_gone" }, { value: "0", columnId: "col_gone" })),
    ],
    ["a position out of range", group(condition({ row: "7" }, { value: "4" }))],
    ["a valueless row condition", group(condition({ row: "1" }))],
    [
      "nested groups",
      group(group(condition({ row: "1" }, { value: "1" })), condition({ row: "0" }, { value: "0" })),
    ],
  ];

  test.each(fixtures)("%s", (_name, conditions) => {
    const blocks = blocksWith(conditions, conditions);

    expect(syncBlocks(blocks)).toEqual(sharedWithMatrixConditionIdsInBlocks(blocks));
    expect(
      planQuotaMatrixIds({ id: "q", updatedAt: "", logic: conditions, blocks }).status === "unchanged"
        ? conditions
        : (planQuotaMatrixIds({ id: "q", updatedAt: "", logic: conditions, blocks }) as { value: unknown })
            .value
    ).toEqual(sharedWithMatrixConditionIds(conditions as never, sharedGetMatrixLookup(blocks)));
  });
});
