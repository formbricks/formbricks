import { describe, expectTypeOf, test } from "vitest";
import type { TSurveyImportDraft } from "@/modules/survey/import/core/draft";
import type { TSurveyImportResult } from "@/modules/survey/import/core/lane";
import type { TSurveyImportStreamEvent } from "./events";

type TDonePayload = Extract<TSurveyImportStreamEvent, { type: "done" }>["payload"];

describe("TSurveyImportStreamEvent", () => {
  // Checked by the type checker: the dialog reads the draft off `done`, so it must not be `unknown`.
  test("types done's payload as the draft the pipeline builds", () => {
    expectTypeOf<TDonePayload>().not.toBeUnknown();
    expectTypeOf<TDonePayload>().toEqualTypeOf<TSurveyImportDraft>();
    expectTypeOf<TDonePayload>().toEqualTypeOf<TSurveyImportResult["payload"]>();
  });
});
