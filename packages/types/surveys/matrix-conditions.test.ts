import { describe, expect, test } from "vitest";
import { z } from "zod";
import type { TSurveyBlock } from "./blocks";
import type { TSurveyMatrixElement } from "./elements";
import type { TConditionGroup, TSingleCondition } from "./logic";
import {
  getMatrixLookup,
  resolveMatrixColumnValue,
  resolveMatrixRowIndex,
  withMatrixColumnIdsFromPositions,
  withMatrixConditionIds,
  withMatrixConditionIdsInBlocks,
} from "./matrix-conditions";
import { surveyFlowFixture } from "./test-fixtures/survey-flow-fixture";
import { type TSurvey, ZSurvey } from "./types";

/**
 * Matrix conditions by id (ENG-6934, json-shapes §10). The fixture's matrix is `brand_grid` (rows
 * `row_netflix`, `row_disney`; columns `col_poor`, `col_good`) on the profile block (index 5), whose
 * first rule's first condition is "Netflix is Good": `meta { row: "0", rowId: "row_netflix" }`,
 * `{ value: "1", columnId: "col_good" }`.
 */

const PROFILE = 5;
const CONDITION_PATH = ["blocks", PROFILE, "logic", 0, "conditions", "conditions", 0];

const matrixOf = (survey: TSurvey): TSurveyMatrixElement =>
  survey.blocks.flatMap((block) => block.elements).find((e) => e.id === "brand_grid") as TSurveyMatrixElement;

const conditionOf = (survey: TSurvey): TSingleCondition =>
  survey.blocks[PROFILE].logic![0].conditions.conditions[0] as TSingleCondition;

const withSurvey = (patch: (survey: TSurvey) => void): TSurvey => {
  const survey = structuredClone(surveyFlowFixture);
  patch(survey);
  return survey;
};

const issuesOf = (survey: TSurvey) =>
  (ZSurvey.safeParse(survey).error?.issues ?? []).map(({ path, message }) => ({ path, message }));

/** The survey's only issue is at `path`, and its message says `text`. */
const expectOnlyIssue = (survey: TSurvey, path: (string | number)[], text: string): void => {
  const issues = issuesOf(survey);
  expect(issues.map((issue) => issue.path)).toEqual([path]);
  expect(issues[0].message).toContain(text);
};

/** Reverses a matrix's rows and columns, as an author dragging them on a live survey would. */
const reorder = (survey: TSurvey): void => {
  const matrix = matrixOf(survey);
  matrix.rows.reverse();
  matrix.columns.reverse();
};

/** The cell a condition points at, read the 6.2 way: ids first. */
const cellByIds = (survey: TSurvey) => {
  const matrix = matrixOf(survey);
  const condition = conditionOf(survey);
  const row = resolveMatrixRowIndex(
    matrix,
    condition.leftOperand.type === "element" ? condition.leftOperand.meta : undefined
  );
  const column = resolveMatrixColumnValue(matrix, condition.rightOperand as never);
  return { row: matrix.rows[row!].id, column: matrix.columns[Number(column)].id };
};

/**
 * The cell a condition points at, read the way the previous release reads it: positions only
 * (`Number(meta.row)` into the rows, the static value into the columns), ids unknown to it.
 */
const cellByPreviousRelease = (survey: TSurvey) => {
  const matrix = matrixOf(survey);
  const condition = conditionOf(survey);
  const meta = condition.leftOperand.type === "element" ? condition.leftOperand.meta : undefined;
  return {
    row: matrix.rows[Number(meta?.row)].id,
    column: matrix.columns[Number(condition.rightOperand?.value)].id,
  };
};

describe("the validator and matrix ids", () => {
  test("the fixture's matrix condition carries both forms and is valid", () => {
    expect(conditionOf(surveyFlowFixture)).toMatchObject({
      leftOperand: { meta: { row: "0", rowId: "row_netflix" } },
      rightOperand: { value: "1", columnId: "col_good" },
    });
    expect(issuesOf(surveyFlowFixture)).toEqual([]);
  });

  test("refuses a row id the matrix doesn't have, at the path of the id", () => {
    const survey = withSurvey((s) => {
      const operand = conditionOf(s).leftOperand as { meta: Record<string, string> };
      operand.meta.rowId = "row_hulu";
    });

    expectOnlyIssue(
      survey,
      [...CONDITION_PATH, "leftOperand", "meta", "rowId"],
      'Row id "row_hulu" does not exist in matrix question "brand_grid"'
    );
  });

  test("refuses a column id the matrix doesn't have, at the path of the id", () => {
    const survey = withSurvey((s) => {
      (conditionOf(s).rightOperand as { columnId: string }).columnId = "col_great";
    });

    expectOnlyIssue(
      survey,
      [...CONDITION_PATH, "rightOperand", "columnId"],
      'Column id "col_great" does not exist in matrix question "brand_grid"'
    );
  });

  test("refuses an unknown id in an isAnyOf list, at its index", () => {
    const survey = withSurvey((s) => {
      const condition = conditionOf(s);
      condition.operator = "isAnyOf";
      condition.rightOperand = { type: "static", value: ["0", "1"], columnIds: ["col_poor", "col_meh"] };
    });

    expectOnlyIssue(survey, [...CONDITION_PATH, "rightOperand", "columnIds", 1], '"col_meh"');
  });

  test("refuses an unknown id in a show-if too", () => {
    const survey = withSurvey((s) => {
      s.blocks[PROFILE].elements[1].showIf = {
        id: "matrixshowifgroup0000001",
        connector: "and",
        conditions: [
          {
            id: "matrixshowifcond00000001",
            leftOperand: { type: "element", value: "brand_grid", meta: { row: "0", rowId: "row_gone" } },
            operator: "isNotEmpty",
          },
        ],
      };
    });

    const issue = issuesOf(survey).find((candidate) => candidate.path[candidate.path.length - 1] === "rowId");

    expect(issue?.path).toEqual([
      "blocks",
      PROFILE,
      "elements",
      1,
      "showIf",
      "conditions",
      0,
      "leftOperand",
      "meta",
      "rowId",
    ]);
    expect(issue?.message).toContain('Row id "row_gone"');
  });

  test("accepts the id form alone, and a stale position next to a valid id", () => {
    const idOnly = withSurvey((s) => {
      (conditionOf(s).leftOperand as { meta: Record<string, string> }).meta = { rowId: "row_disney" };
    });
    const stalePosition = withSurvey((s) => {
      (conditionOf(s).leftOperand as { meta: Record<string, string> }).meta.row = "7";
    });

    expect(issuesOf(idOnly)).toEqual([]);
    expect(issuesOf(stalePosition)).toEqual([]);
  });
});

describe("the engines' reading: ids first, positions as the fallback", () => {
  const matrix = { rows: [{ id: "r0" }, { id: "r1" }], columns: [{ id: "c0" }, { id: "c1" }, { id: "c2" }] };

  test("a row id wins over a position that disagrees; an unknown id points at no row", () => {
    expect(resolveMatrixRowIndex(matrix, { row: "0", rowId: "r1" })).toBe(1);
    expect(resolveMatrixRowIndex(matrix, { row: "0", rowId: "r9" })).toBeUndefined();
  });

  test("without ids, the position is read, and an out-of-range one points at no row", () => {
    expect(resolveMatrixRowIndex(matrix, { row: "1" })).toBe(1);
    expect(resolveMatrixRowIndex(matrix, { row: "2" })).toBeUndefined();
  });

  test("a column id wins over the position, for one column and for a list", () => {
    expect(resolveMatrixColumnValue(matrix, { type: "static", value: "0", columnId: "c2" })).toBe("2");
    expect(
      resolveMatrixColumnValue(matrix, { type: "static", value: ["0"], columnIds: ["c1", "c2"] })
    ).toEqual(["1", "2"]);
    expect(resolveMatrixColumnValue(matrix, { type: "static", value: "1" })).toBe("1");
  });

  test("an unknown column id never reads as a column", () => {
    expect(resolveMatrixColumnValue(matrix, { type: "static", value: "0", columnId: "c9" })).toBe("-1");
  });
});

describe("the write path keeps both forms in sync", () => {
  const positionsOnly = (): TSurvey =>
    withSurvey((s) => {
      const condition = conditionOf(s);
      (condition.leftOperand as { meta: Record<string, string> }).meta = { row: "0" };
      condition.rightOperand = { type: "static", value: "1" };
    });

  test("adds the ids next to stored positions", () => {
    const blocks = withMatrixConditionIdsInBlocks(positionsOnly().blocks);
    const survey = { ...surveyFlowFixture, blocks };

    expect(conditionOf(survey)).toMatchObject({
      leftOperand: { meta: { row: "0", rowId: "row_netflix" } },
      rightOperand: { value: "1", columnId: "col_good" },
    });
  });

  test("after a reorder, rewrites the positions from the ids, so the condition keeps its cell", () => {
    const survey = withSurvey(reorder);
    const synced = { ...survey, blocks: withMatrixConditionIdsInBlocks(survey.blocks) };

    expect(conditionOf(synced)).toMatchObject({
      leftOperand: { meta: { row: "1", rowId: "row_netflix" } },
      rightOperand: { value: "0", columnId: "col_good" },
    });
  });

  test("keeps an isAnyOf list in sync", () => {
    const group: TConditionGroup = {
      id: "g",
      connector: "and",
      conditions: [
        {
          id: "c",
          leftOperand: { type: "element", value: "brand_grid", meta: { row: "1" } },
          operator: "isAnyOf",
          rightOperand: { type: "static", value: ["1", "0"] },
        },
      ],
    };
    const findMatrix = getMatrixLookup(surveyFlowFixture.blocks);

    expect(withMatrixConditionIds(group, findMatrix).conditions[0]).toMatchObject({
      leftOperand: { meta: { row: "1", rowId: "row_disney" } },
      rightOperand: { value: ["1", "0"], columnIds: ["col_good", "col_poor"] },
    });
  });

  test("syncs show-if conditions and quota-shaped groups too", () => {
    const blocks: TSurveyBlock[] = structuredClone(surveyFlowFixture.blocks);
    blocks[PROFILE].elements[1].showIf = {
      id: "showif",
      connector: "and",
      conditions: [
        {
          id: "s",
          leftOperand: { type: "element", value: "brand_grid", meta: { row: "1" } },
          operator: "equals",
          rightOperand: { type: "static", value: "0" },
        },
      ],
    };
    const quota = {
      connector: "and",
      conditions: [structuredClone(blocks[PROFILE].elements[1].showIf.conditions[0])],
    };

    const synced = withMatrixConditionIdsInBlocks(blocks);
    const expected = {
      leftOperand: { meta: { row: "1", rowId: "row_disney" } },
      rightOperand: { value: "0", columnId: "col_poor" },
    };

    expect(synced[PROFILE].elements[1].showIf?.conditions[0]).toMatchObject(expected);
    expect(withMatrixConditionIds(quota, getMatrixLookup(blocks)).conditions[0]).toMatchObject(expected);
  });

  test("leaves an already synced survey untouched, block for block", () => {
    const blocks = withMatrixConditionIdsInBlocks(surveyFlowFixture.blocks);

    blocks.forEach((block, index) => expect(block).toBe(surveyFlowFixture.blocks[index]));
  });

  test("leaves an unknown id for the validator to report, rather than guessing a position", () => {
    const survey = withSurvey((s) => {
      (conditionOf(s).leftOperand as { meta: Record<string, string> }).meta.rowId = "row_gone";
    });

    expect(withMatrixConditionIdsInBlocks(survey.blocks)[PROFILE]).toBe(survey.blocks[PROFILE]);
  });

  test("an editor pick by position replaces the column ids", () => {
    const matrix = matrixOf(surveyFlowFixture);

    expect(
      withMatrixColumnIdsFromPositions(matrix, { type: "static", value: "0", columnId: "col_good" })
    ).toEqual({
      type: "static",
      value: "0",
      columnId: "col_poor",
    });
  });
});

describe("rolling upgrade: a survey written by 6.2 on the previous release", () => {
  /** The previous release's static right operand: `columnId` unknown to it, so stripped. */
  const ZPreviousRightOperandStatic = z.object({
    type: z.literal("static"),
    value: z.union([z.string(), z.number(), z.array(z.string())]),
  });

  test("a reordered, re-saved survey reads the same cell with the previous release's rules", () => {
    const before = cellByIds(surveyFlowFixture);
    const reordered = withSurvey(reorder);
    const saved = { ...reordered, blocks: withMatrixConditionIdsInBlocks(reordered.blocks) };

    expect(before).toEqual({ row: "row_netflix", column: "col_good" });
    expect(cellByIds(saved)).toEqual(before);
    expect(cellByPreviousRelease(saved)).toEqual(before);
  });

  test("the previous release's schema still accepts it, and its row position is in range", () => {
    const reordered = withSurvey(reorder);
    const saved = { ...reordered, blocks: withMatrixConditionIdsInBlocks(reordered.blocks) };
    const condition = conditionOf(saved);
    const meta = condition.leftOperand.type === "element" ? condition.leftOperand.meta : undefined;

    expect(ZPreviousRightOperandStatic.safeParse(condition.rightOperand).success).toBe(true);
    expect(Number(meta?.row)).toBeLessThan(matrixOf(saved).rows.length);
  });
});
