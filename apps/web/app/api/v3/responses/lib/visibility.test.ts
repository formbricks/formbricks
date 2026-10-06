import { beforeEach, describe, expect, test, vi } from "vitest";
import { can } from "@/lib/authorization";
import { isSurveyVisibilityReady } from "@/lib/authzed/scope-readiness";
import { refuseUnlessV3SurveyVisible } from "./visibility";

vi.mock("@/lib/authorization", () => ({ can: vi.fn() }));
vi.mock("@/lib/authzed/scope-readiness", () => ({ isSurveyVisibilityReady: vi.fn() }));
vi.mock("@/lib/survey/visibility/actor-context", () => ({ resolveSurveyActorContext: vi.fn() }));

const session = { expires: "2099-01-01", user: { id: "user_1" } } as never;
const resource = { type: "response", id: "resp_1" } as const;

describe("refuseUnlessV3SurveyVisible (ENG-3282)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("asks nothing while survey visibility is not enforced", async () => {
    vi.mocked(isSurveyVisibilityReady).mockResolvedValue(false);

    await expect(refuseUnlessV3SurveyVisible(session, "response.read", resource, "req")).resolves.toBeNull();
    expect(can).not.toHaveBeenCalled();
  });

  test("lets a caller the graph admits through", async () => {
    vi.mocked(isSurveyVisibilityReady).mockResolvedValue(true);
    vi.mocked(can).mockResolvedValue(true);

    await expect(refuseUnlessV3SurveyVisible(session, "response.read", resource, "req")).resolves.toBeNull();
    expect(can).toHaveBeenCalledWith({ type: "user", id: "user_1" }, "response.read", resource);
  });

  test("answers the shared 403 for a caller it does not", async () => {
    vi.mocked(isSurveyVisibilityReady).mockResolvedValue(true);
    vi.mocked(can).mockResolvedValue(false);

    const refused = await refuseUnlessV3SurveyVisible(session, "response.read", resource, "req", "/x");

    expect(refused?.status).toBe(403);
    expect(await refused?.json()).toMatchObject({ code: "forbidden" });
  });
});
