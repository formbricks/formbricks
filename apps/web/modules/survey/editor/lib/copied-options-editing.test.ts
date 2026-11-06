import { describe, expect, test } from "vitest";
import { surveyFlowFixture } from "@formbricks/types/surveys/test-fixtures/survey-flow-fixture";
import { getCopiedOptionsSource } from "./copied-options-editing";

/**
 * Copied options in the editor (ENG-6938, P70). The fixture's question `recommend` (block 5, element
 * 12) copies its options from `services` (block 0).
 */

describe("codes of copied options in the Recode section", () => {
  test("names the source and which options are copies", () => {
    const recommend = surveyFlowFixture.blocks[5].elements[12];
    const copied = getCopiedOptionsSource(surveyFlowFixture, recommend);

    expect(copied?.source.id).toBe("services");
    expect([...(copied?.copiedIds ?? [])]).toEqual(["netflix", "disney", "prime", "apple"]);
  });

  test("a question that copies nothing has no source", () => {
    expect(getCopiedOptionsSource(surveyFlowFixture, surveyFlowFixture.blocks[4].elements[0])).toBeNull();
  });
});
