import { NextRequest } from "next/server";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { authenticateRequest } from "@/app/api/v1/auth";
import { can } from "@/lib/authorization";
import { isSurveyVisibilityReady } from "@/lib/authzed/scope-readiness";
import { getSession } from "@/modules/auth/lib/session";
import { authorizePrivateDownload } from "./auth";

vi.mock("server-only", () => ({}));
vi.mock("@/app/api/v1/auth", () => ({ authenticateRequest: vi.fn() }));
vi.mock("@/lib/authorization", () => ({ can: vi.fn() }));
vi.mock("@/lib/authzed/scope-readiness", () => ({ isSurveyVisibilityReady: vi.fn() }));
vi.mock("@/modules/auth/lib/session", () => ({ getSession: vi.fn() }));

const request = new NextRequest("http://localhost/storage/ws-1/private/file");

/** Grants the workspace check; denies the survey check for `restricted-survey` only. */
const grantAllButRestrictedSurvey = (): void => {
  vi.mocked(can).mockImplementation(async (_actor, _action, resource) => {
    return !(resource.type === "survey" && resource.id === "restricted-survey");
  });
};

const surveyChecks = (): unknown[] =>
  vi.mocked(can).mock.calls.filter(([, , resource]) => resource.type === "survey");

describe("authorizePrivateDownload survey scoping", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getSession).mockResolvedValue({ user: { id: "user-1" } } as never);
    vi.mocked(isSurveyVisibilityReady).mockResolvedValue(true);
    grantAllButRestrictedSurvey();
  });

  // The route passes the segments the router has already decoded once, and storage builds its key from
  // them joined as they are. Each of these is the key `surveys/restricted-survey/…`, so each must hit the
  // survey check. (`surveys%2F…` in the URL arrives as the second shape.)
  test.each([
    ["plain segments", ["surveys", "restricted-survey", "elements", "el-1", "a.png"]],
    ["slashes the router already decoded", ["surveys/restricted-survey/a.png"]],
  ])("refuses a restricted survey's file named with %s", async (_label, filePath) => {
    for (const method of ["GET", "DELETE"] as const) {
      const result = await authorizePrivateDownload(request, "ws-1", method, filePath);
      expect(result).toEqual({ ok: false, error: { unauthorized: true } });
    }
    expect(surveyChecks()).toHaveLength(2);
    expect(vi.mocked(can)).toHaveBeenCalledWith({ type: "user", id: "user-1" }, "survey.manage", {
      type: "survey",
      id: "restricted-survey",
    });
  });

  test("refuses a restricted survey's file for an API key too", async () => {
    vi.mocked(getSession).mockResolvedValue(null);
    vi.mocked(authenticateRequest).mockResolvedValue({ apiKeyId: "key-1" } as never);

    const result = await authorizePrivateDownload(request, "ws-1", "GET", [
      "surveys/restricted-survey/a.png",
    ]);

    expect(result).toEqual({ ok: false, error: { unauthorized: true } });
    expect(vi.mocked(can)).toHaveBeenCalledWith({ type: "apiKey", id: "key-1" }, "survey.read", {
      type: "survey",
      id: "restricted-survey",
    });
  });

  test("allows a reachable survey's file", async () => {
    const result = await authorizePrivateDownload(request, "ws-1", "GET", ["surveys/open-survey/a.png"]);

    expect(result).toEqual({ ok: true, data: { authType: "session", userId: "user-1" } });
    expect(vi.mocked(can)).toHaveBeenCalledWith({ type: "user", id: "user-1" }, "survey.read", {
      type: "survey",
      id: "open-survey",
    });
  });

  // Storage no longer decodes the name a second time, so a literal `%…` in it is part of the key. These
  // are flat keys, not the survey's, and the survey check must not read them as `surveys/restricted-survey/…`.
  test.each([
    ["an encoded segment", ["%73urveys", "restricted-survey", "a.png"]],
    ["encoded slashes", ["surveys%2Frestricted-survey%2Fa.png"]],
  ])("keeps the workspace check alone for a flat key with %s", async (_label, filePath) => {
    const result = await authorizePrivateDownload(request, "ws-1", "GET", filePath);

    expect(result.ok).toBe(true);
    expect(surveyChecks()).toHaveLength(0);
  });

  test("keeps the workspace check alone for a legacy flat key", async () => {
    const result = await authorizePrivateDownload(request, "ws-1", "GET", ["report--fid--abc.pdf"]);

    expect(result.ok).toBe(true);
    expect(surveyChecks()).toHaveLength(0);
  });

  // Regression (ENG-3077): a bare `%` used to be refused as "does not decode", so a survey upload named
  // `100%.png` could not be downloaded or deleted at all.
  test.each(["GET", "DELETE"] as const)(
    "checks the survey, not the decoding, for a file name with a bare percent sign on %s",
    async (method) => {
      const result = await authorizePrivateDownload(request, "ws-1", method, [
        "surveys",
        "open-survey",
        "elements",
        "el-1",
        "100%--fid--abc.png",
      ]);

      expect(result.ok).toBe(true);
      expect(surveyChecks()).toHaveLength(1);
    }
  );

  test("refuses a survey-scoped key with an empty survey segment", async () => {
    const result = await authorizePrivateDownload(request, "ws-1", "GET", ["surveys//a.png"]);

    expect(result).toEqual({ ok: false, error: { unauthorized: true } });
  });

  test("denies a restricted file even before graph readiness", async () => {
    vi.mocked(isSurveyVisibilityReady).mockResolvedValue(false);

    const result = await authorizePrivateDownload(request, "ws-1", "GET", [
      "surveys/restricted-survey/a.png",
    ]);

    expect(result.ok).toBe(false);
    expect(surveyChecks()).toHaveLength(1);
  });
});
