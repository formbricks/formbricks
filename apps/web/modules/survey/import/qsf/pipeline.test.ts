import { describe, expect, test, vi } from "vitest";
import { prepareV3SurveyCreateInput } from "@/app/api/v3/surveys/prepare";
import { QsfImportInputError, prepareQsfImport, runQsfImport } from "./pipeline";

vi.mock("server-only", () => ({}));

const minimalQsf = {
  SurveyEntry: { SurveyID: "SV_1", SurveyName: "Customer onboarding" },
  SurveyElements: [],
};

const workspaceId = "clxx1234567890123456789012";

describe("prepareQsfImport", () => {
  test("reads a Qualtrics export's envelope", () => {
    expect(prepareQsfImport(minimalQsf, "onboarding.qsf")).toEqual({
      fileName: "onboarding.qsf",
      surveyName: "Customer onboarding",
    });
  });

  test("tolerates keys it does not know, since Qualtrics adds them between versions", () => {
    expect(() =>
      prepareQsfImport(
        { ...minimalQsf, SurveyEntry: { ...minimalQsf.SurveyEntry, NewKey: 1 }, Extra: {} },
        "a.qsf"
      )
    ).not.toThrow();
  });

  test.each([
    ["any other JSON file", { name: "not a survey" }, "qsf.SurveyEntry"],
    [
      "an export without a survey name",
      { SurveyEntry: { SurveyName: "  " }, SurveyElements: [] },
      "qsf.SurveyEntry.SurveyName",
    ],
    ["an export without elements", { SurveyEntry: { SurveyName: "S" } }, "qsf.SurveyElements"],
  ])("refuses %s, naming what is missing", (_case, qsf, paramName) => {
    let caught: unknown;
    try {
      prepareQsfImport(qsf, "file.qsf");
    } catch (error) {
      caught = error;
    }

    expect(caught).toBeInstanceOf(QsfImportInputError);
    expect((caught as QsfImportInputError).invalidParams.map((param) => param.name)).toContain(paramName);
  });
});

describe("runQsfImport (stub until ENG-3654)", () => {
  const prepared = { fileName: "onboarding.qsf", surveyName: "Customer onboarding" };

  test("returns a draft that POST /api/v3/surveys accepts, with a report", async () => {
    const onProgress = vi.fn();

    const result = await runQsfImport({
      prepared,
      workspaceId,
      organizationId: "org_1",
      userId: "user_1",
      signal: new AbortController().signal,
      onProgress,
    });

    // What the dialog does with it: POST /api/v3/surveys runs exactly this preparation.
    expect(prepareV3SurveyCreateInput(result.payload).ok).toBe(true);
    expect(result.payload).toMatchObject({
      workspaceId,
      name: "Customer onboarding (imported)",
      status: "draft",
    });
    expect(result.report.source).toEqual({ kind: "qsf", fileName: "onboarding.qsf" });
    expect(onProgress.mock.calls.map(([stage]) => stage)).toEqual(["ai", "assembling"]);
  });

  test("stops at once when the import was aborted", async () => {
    const controller = new AbortController();
    controller.abort();
    const onProgress = vi.fn();

    await expect(
      runQsfImport({
        prepared,
        workspaceId,
        organizationId: "org_1",
        userId: null,
        signal: controller.signal,
        onProgress,
      })
    ).rejects.toThrow();
    expect(onProgress).not.toHaveBeenCalled();
  });
});
