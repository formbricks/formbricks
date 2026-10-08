import { beforeEach, describe, expect, test, vi } from "vitest";
import { can } from "@/lib/authorization";
import { lookupAuthorizedWorkspaceIds } from "@/lib/authorization/resource-list";
import { resolveSurveyActorContext } from "@/lib/survey/visibility/actor-context";
import { resolveRetentionExemptionReadScope } from "./exemption-read-scope";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/authorization", () => ({ can: vi.fn() }));
vi.mock("@/lib/authorization/resource-list", () => ({ lookupAuthorizedWorkspaceIds: vi.fn() }));
vi.mock("@/lib/survey/visibility/actor-context", () => ({ resolveSurveyActorContext: vi.fn() }));

const ORG_ID = "clorg11111111111111111111";
const USER_ID = "cluser1111111111111111111";
const ACTOR = { type: "user", id: USER_ID };

describe("resolveRetentionExemptionReadScope", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("gives owners and managers the whole organisation, without looking up workspaces", async () => {
    vi.mocked(can).mockResolvedValue(true);

    await expect(resolveRetentionExemptionReadScope(USER_ID, ORG_ID)).resolves.toEqual({
      kind: "organization",
    });
    expect(can).toHaveBeenCalledWith(ACTOR, "organization.manage", { type: "organization", id: ORG_ID });
    expect(lookupAuthorizedWorkspaceIds).not.toHaveBeenCalled();
  });

  test("limits anyone else to the surveys they could open", async () => {
    const actorContext = {
      enforced: true,
      isOrganizationAdmin: false,
      kind: "user",
      userId: USER_ID,
    } as const;
    vi.mocked(can).mockResolvedValue(false);
    vi.mocked(lookupAuthorizedWorkspaceIds).mockResolvedValue(["clwsp11111111111111111111"]);
    vi.mocked(resolveSurveyActorContext).mockResolvedValue(actorContext);

    await expect(resolveRetentionExemptionReadScope(USER_ID, ORG_ID)).resolves.toEqual({
      kind: "surveys",
      workspaceIds: ["clwsp11111111111111111111"],
      actorContext,
    });
    expect(lookupAuthorizedWorkspaceIds).toHaveBeenCalledWith(ACTOR);
    expect(resolveSurveyActorContext).toHaveBeenCalledWith(ACTOR, ORG_ID);
  });
});
