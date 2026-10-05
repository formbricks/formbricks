import { beforeEach, describe, expect, test, vi } from "vitest";
import { requireSessionWorkspaceAccess } from "@/app/api/v3/lib/auth";
import { can } from "@/lib/authorization";
import { getSurvey } from "@/lib/survey/service";
import { assertCustomCssAccess } from "@/modules/survey/lib/custom-css-permission";
import { validateCustomCss } from "./operations";

vi.mock("server-only", () => ({}));
vi.mock("@/app/api/v3/lib/auth", () => ({
  requireSessionWorkspaceAccess: vi.fn(),
  getV3AuthorizationActor: () => ({ type: "user", id: "user" }),
}));
vi.mock("@/lib/authorization", () => ({ can: vi.fn() }));
vi.mock("@/lib/survey/service", () => ({ getSurvey: vi.fn() }));
vi.mock("@/modules/survey/lib/custom-css-permission", () => ({ assertCustomCssAccess: vi.fn() }));

const input = {
  scope: "survey",
  surveyId: "survey",
  workspaceId: "ws",
  light: ".a{color:red}",
  dark: "",
} as const;
const run = (overrides: { light?: string; dark?: string } = {}) =>
  validateCustomCss({ authentication: null, input: { ...input, ...overrides }, requestId: "request" });

describe("custom CSS validation authorization", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(requireSessionWorkspaceAccess).mockResolvedValue({ workspaceId: "ws", organizationId: "org" });
    vi.mocked(can).mockResolvedValue(true);
    vi.mocked(getSurvey).mockResolvedValue({ workspaceId: "ws", archivedAt: null } as Awaited<
      ReturnType<typeof getSurvey>
    >);
    vi.mocked(assertCustomCssAccess).mockResolvedValue(undefined);
  });

  test("returns the shared auth refusal before parsing CSS", async () => {
    vi.mocked(requireSessionWorkspaceAccess).mockResolvedValue(new Response(null, { status: 401 }));
    expect((await run()).status).toBe(401);
    expect(getSurvey).not.toHaveBeenCalled();
  });

  test("refuses a private survey and a survey in a different workspace", async () => {
    vi.mocked(can).mockResolvedValue(false);
    expect((await run()).status).toBe(403);
    expect(getSurvey).not.toHaveBeenCalled();
    vi.mocked(can).mockResolvedValue(true);
    vi.mocked(getSurvey).mockResolvedValue({ workspaceId: "other" } as Awaited<ReturnType<typeof getSurvey>>);
    expect((await run()).status).toBe(403);
    expect(assertCustomCssAccess).not.toHaveBeenCalled();
  });

  test("returns processed output and warnings and leaves source intact", async () => {
    const response = await run({ light: ".a{color:red;background:url(https://evil.example)}" });
    expect(response.status).toBe(200);
    const { data } = await response.json();
    expect(data.compiled.light.compiled).toBe("#fbjs .a{color:red !important;}");
    expect(data.removed).toHaveLength(1);
  });

  test("returns a problem response for a syntax error", async () => {
    const response = await run({ light: ".a{" });
    expect(response.status).toBe(422);
    expect(response.headers.get("content-type")).toContain("application/problem+json");
  });
});
