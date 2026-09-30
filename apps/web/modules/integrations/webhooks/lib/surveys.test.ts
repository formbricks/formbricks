import { beforeEach, describe, expect, test, vi } from "vitest";
import { getSurveys } from "@/lib/survey/service";
import { getUserVisibleSurveyWhere } from "@/lib/survey/visibility/actor-context";
import { buildVisibleSurveyWhere } from "@/lib/survey/visibility/predicate";
import { getWebhookSurveys } from "./surveys";

vi.mock("@/lib/survey/service", () => ({ getSurveys: vi.fn() }));
vi.mock("@/lib/survey/visibility/actor-context", () => ({ getUserVisibleSurveyWhere: vi.fn() }));

const workspaceId = "workspace-id";
const memberId = "member-user-id";
const organizationId = "organization-id";

describe("getWebhookSurveys", () => {
  beforeEach(() => {
    vi.mocked(getSurveys).mockResolvedValue([]);
  });

  // ENG-3395: the webhook picker must never offer a member another user's restricted survey, so the
  // member's own visibility clause has to reach the survey query.
  test("loads a member's surveys through their visibility clause", async () => {
    const memberClause = buildVisibleSurveyWhere({
      enforced: true,
      kind: "user",
      userId: memberId,
      isOrganizationAdmin: false,
    });
    vi.mocked(getUserVisibleSurveyWhere).mockResolvedValue(memberClause);

    await getWebhookSurveys(workspaceId, memberId, organizationId);

    expect(getUserVisibleSurveyWhere).toHaveBeenCalledWith(memberId, organizationId);
    expect(getSurveys).toHaveBeenCalledWith(
      workspaceId,
      {
        OR: [
          {
            visibility: "workspace",
            OR: [
              { visibilityPending: false },
              { visibilityProjectedVersion: { lt: 0 }, visibilityVersion: 0 },
            ],
          },
          { ownerId: memberId },
        ],
      },
      200
    );
  });

  test("with enforcement off, loads the workspace's surveys as before", async () => {
    vi.mocked(getUserVisibleSurveyWhere).mockResolvedValue({});

    await getWebhookSurveys(workspaceId, memberId, organizationId);

    expect(getSurveys).toHaveBeenCalledWith(workspaceId, {}, 200);
  });
});
