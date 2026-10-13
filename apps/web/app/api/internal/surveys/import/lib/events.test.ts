import { describe, expectTypeOf, test } from "vitest";
import type { TQsfDraftDocument } from "@/modules/survey/import/qsf/draft";
import type { TQsfImportResult } from "@/modules/survey/import/qsf/pipeline";
import type { TQsfImportStreamEvent } from "./events";

type TDonePayload = Extract<TQsfImportStreamEvent, { type: "done" }>["payload"];

describe("TQsfImportStreamEvent", () => {
  // Checked by the type checker: the dialog reads the draft off `done`, so it must not be `unknown`.
  test("types done's payload as the draft the pipeline builds", () => {
    expectTypeOf<TDonePayload>().not.toBeUnknown();
    expectTypeOf<TDonePayload>().toEqualTypeOf<TQsfDraftDocument>();
    expectTypeOf<TDonePayload>().toEqualTypeOf<TQsfImportResult["payload"]>();
  });
});
