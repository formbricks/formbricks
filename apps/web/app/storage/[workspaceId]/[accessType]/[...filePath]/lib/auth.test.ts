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

  // Each of these reaches storage key `surveys/restricted-survey/…` once the storage layer decodes the
  // joined name, so each must hit the survey check.
  test.each([
    ["plain segments", ["surveys", "restricted-survey", "elements", "el-1", "a.png"]],
    ["an encoded segment", ["%73urveys", "restricted-survey", "a.png"]],
    ["encoded slashes", ["surveys%2Frestricted-survey%2Felements%2Fel-1%2Fa.png"]],
    // `%252F` in the URL: the router decodes it once to `%2F`, the storage layer decodes it to `/`.
    ["double-encoded slashes after the router's decode", ["surveys%2Frestricted-survey%2Fa.png"]],
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

  test("refuses an encoded-slash path for an API key too", async () => {
    vi.mocked(getSession).mockResolvedValue(null);
    vi.mocked(authenticateRequest).mockResolvedValue({ apiKeyId: "key-1" } as never);

    const result = await authorizePrivateDownload(request, "ws-1", "GET", [
      "surveys%2Frestricted-survey%2Fa.png",
    ]);

    expect(result).toEqual({ ok: false, error: { unauthorized: true } });
    expect(vi.mocked(can)).toHaveBeenCalledWith({ type: "apiKey", id: "key-1" }, "survey.read", {
      type: "survey",
      id: "restricted-survey",
    });
  });

  test("allows a reachable survey's file", async () => {
    const result = await authorizePrivateDownload(request, "ws-1", "GET", ["surveys%2Fopen-survey%2Fa.png"]);

    expect(result).toEqual({ ok: true, data: { authType: "session", userId: "user-1" } });
    expect(vi.mocked(can)).toHaveBeenCalledWith({ type: "user", id: "user-1" }, "survey.read", {
      type: "survey",
      id: "open-survey",
    });
  });

  test("keeps the workspace check alone for a triple-encoded name, whose storage key is flat", async () => {
    // The router and storage each decode once, so the key is the literal `surveys%2F…`, not the survey's.
    const result = await authorizePrivateDownload(request, "ws-1", "GET", [
      "surveys%252Frestricted-survey%252Fa.png",
    ]);

    expect(result.ok).toBe(true);
    expect(surveyChecks()).toHaveLength(0);
  });

  test("keeps the workspace check alone for a legacy flat key", async () => {
    const result = await authorizePrivateDownload(request, "ws-1", "GET", ["report--fid--abc.pdf"]);

    expect(result.ok).toBe(true);
    expect(surveyChecks()).toHaveLength(0);
  });

  test("refuses a name that does not decode", async () => {
    const result = await authorizePrivateDownload(request, "ws-1", "DELETE", ["surveys%E0%A4%A", "a.png"]);

    expect(result).toEqual({ ok: false, error: { unauthorized: true } });
  });

  test("refuses a survey-scoped key with an empty survey segment", async () => {
    const result = await authorizePrivateDownload(request, "ws-1", "GET", ["surveys%2F%2Fa.png"]);

    expect(result).toEqual({ ok: false, error: { unauthorized: true } });
  });

  test("makes no survey check while visibility is not enforced", async () => {
    vi.mocked(isSurveyVisibilityReady).mockResolvedValue(false);

    const result = await authorizePrivateDownload(request, "ws-1", "GET", [
      "surveys%2Frestricted-survey%2Fa.png",
    ]);

    expect(result.ok).toBe(true);
    expect(surveyChecks()).toHaveLength(0);
  });
});
