import { afterEach, describe, expect, test, vi } from "vitest";
import { jsonResponse } from "@/modules/api/lib/hook-test-utils";
import { updateInviteRole, updateMemberRole } from "./api-client";

const ORG_ID = "clorg11111111111111111111";
const USER_ID = "cluser1111111111111111111";
const INVITE_ID = "6a3c1a9e-2f4b-4c8d-9e1f-0a1b2c3d4e5f";

const stubFetch = (response: Response) => {
  const fetchMock = vi.fn().mockResolvedValue(response);
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("role management API client", () => {
  test("PATCHes a member's role in the named organization", async () => {
    const fetchMock = stubFetch(
      jsonResponse({ data: { userId: USER_ID, organizationId: ORG_ID, role: "manager" } })
    );

    await expect(
      updateMemberRole({ userId: USER_ID, organizationId: ORG_ID, body: { role: "manager" } })
    ).resolves.toEqual({ userId: USER_ID, organizationId: ORG_ID, role: "manager" });
    expect(fetchMock).toHaveBeenCalledWith(
      `/api/internal/members/${USER_ID}?organizationId=${ORG_ID}`,
      expect.objectContaining({ method: "PATCH", body: JSON.stringify({ role: "manager" }) })
    );
  });

  test("PATCHes an invite's role", async () => {
    const fetchMock = stubFetch(jsonResponse({ data: { id: INVITE_ID, role: "member" } }));

    await expect(updateInviteRole({ inviteId: INVITE_ID, body: { role: "member" } })).resolves.toEqual({
      id: INVITE_ID,
      role: "member",
    });
    expect(fetchMock).toHaveBeenCalledWith(
      `/api/internal/invites/${INVITE_ID}`,
      expect.objectContaining({ method: "PATCH", body: JSON.stringify({ role: "member" }) })
    );
  });

  test("throws the server's reason for a refused role change", async () => {
    stubFetch(
      jsonResponse(
        { status: 409, detail: "You cannot demote the last owner of the organization", code: "conflict" },
        409
      )
    );

    await expect(
      updateMemberRole({ userId: USER_ID, organizationId: ORG_ID, body: { role: "member" } })
    ).rejects.toMatchObject({ status: 409, detail: "You cannot demote the last owner of the organization" });
  });
});
