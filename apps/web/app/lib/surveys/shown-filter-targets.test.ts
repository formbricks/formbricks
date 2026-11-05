import type { TFunction } from "i18next";
import { describe, expect, test } from "vitest";
import {
  SURVEY_FLOW_FIXTURE_IDS,
  surveyFlowFixture,
} from "@formbricks/types/surveys/test-fixtures/survey-flow-fixture";
import { getShownFilterTargets } from "./shown-filter-targets";

const t = ((key: string, values?: Record<string, unknown>) =>
  values ? `${key} ${JSON.stringify(values)}` : key) as unknown as TFunction;

const ids = (recorded?: Parameters<typeof getShownFilterTargets>[2]) =>
  getShownFilterTargets(surveyFlowFixture, t, recorded).map((entry) => entry.propertyId);

const { heavyUsers, overall } = SURVEY_FLOW_FIXTURE_IDS.blocks;

describe("getShownFilterTargets", () => {
  test("offers what a show-if or Hidden can keep from a respondent, at every level", () => {
    const offered = ids();

    expect(offered).toEqual(
      expect.arrayContaining([
        `shown.block.${heavyUsers}`,
        "shown.question.apple_reason",
        "shown.option.fav.apple",
        // Hidden, not show-if.
        "shown.option.bundle.netflix_apple",
        "shown.row.brand_grid.row_disney",
        "shown.option.brand_rank.prime",
        "shown.option.ad_pick.poster_b",
      ])
    );
    // Nothing the survey always shows.
    expect(offered).not.toContain(`shown.block.${overall}`);
    expect(offered).not.toContain("shown.question.fav");
    expect(offered).not.toContain("shown.option.fav.netflix");
    expect(offered.some((id) => id.startsWith("shown.column."))).toBe(false);
  });

  test("names each target the way the filter reads it", () => {
    const byId = new Map(
      getShownFilterTargets(surveyFlowFixture, t).map((entry) => [entry.propertyId, entry])
    );

    expect(byId.get(`shown.block.${heavyUsers}`)?.target).toEqual({ target: "block", blockId: heavyUsers });
    expect(byId.get("shown.option.fav.apple")).toMatchObject({
      target: { target: "option", elementId: "fav", itemId: "apple" },
      label: expect.stringMatching(/ · Apple TV\+$/),
    });
    expect(byId.get("shown.row.brand_grid.row_disney")).toMatchObject({
      target: { target: "row", elementId: "brand_grid", itemId: "row_disney" },
      label: expect.stringContaining("workspace.surveys.filter.shown_target_row"),
    });
    // A picture has no label: its position names it.
    expect(byId.get("shown.option.ad_pick.poster_b")?.label).toContain('"number":2');
  });

  test("also offers what a response was recorded as not shown, so a removed show-if stays filterable", () => {
    const offered = ids({
      elements: ["fav"],
      columns: { brand_grid: ["col_good"] },
      // Ids the survey does not hold have nothing to name: left out.
      blocks: ["ghost_block"],
      options: { ghost: ["x"] },
    });

    expect(offered).toContain("shown.question.fav");
    expect(offered).toContain("shown.column.brand_grid.col_good");
    expect(offered.some((id) => id.includes("ghost"))).toBe(false);
    expect(offered).toHaveLength(ids().length + 2);
  });

  test("a block every element of which can be hidden is offered as a block", () => {
    const survey = {
      ...surveyFlowFixture,
      blocks: [
        {
          id: "only_block",
          name: "Only",
          elements: [
            {
              ...surveyFlowFixture.blocks[0].elements[0],
              id: "q",
              showIf: { id: "g", connector: "and", conditions: [{ id: "c" }] },
            },
          ],
        },
      ],
    } as unknown as typeof surveyFlowFixture;

    expect(getShownFilterTargets(survey, t).map((entry) => entry.propertyId)).toEqual([
      "shown.block.only_block",
      "shown.question.q",
    ]);
  });
});
