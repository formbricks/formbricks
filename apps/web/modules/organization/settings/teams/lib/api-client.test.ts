import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { jsonResponse as json, routeFetch } from "@/modules/api/lib/hook-test-utils";
import { V3ApiError } from "@/modules/api/lib/v3-client";
import {
  createInviteShareLink,
  deleteInvite,
  deleteMember,
  inviteMember,
  inviteMembers,
  leaveOrganization,
  resendInvite,
} from "./api-client";

const ORG_ID = "clorg11111111111111111111";
const USER_ID = "cluser1111111111111111111";
const INVITE_ID = "6a3c1a9e-2f4b-4c8d-9e1f-0a1b2c3d4e5f";
const invitee = { email: "a@example.com", name: "A", role: "member" as const, teamIds: [] };

const call = (index = 0) => vi.mocked(global.fetch).mock.calls[index];
const sentBody = (index = 0) => JSON.parse(String(call(index)[1]?.body));

describe("members API client", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  test("POSTs a single invite and a batch to the organization, without a client timeout", async () => {
    const results = [{ email: "a@example.com", success: true }];
    routeFetch({
      [`POST /api/internal/invites?organizationId=${ORG_ID}`]: [json({ data: { id: INVITE_ID } }, 201)],
      [`POST /api/internal/invites/batches?organizationId=${ORG_ID}`]: [json({ data: results })],
    });

    expect(await inviteMember({ organizationId: ORG_ID, body: invitee })).toEqual({ id: INVITE_ID });
    expect(sentBody(0)).toEqual(invitee);
    expect(call(0)[1]?.signal).toBeUndefined();

    expect(await inviteMembers({ organizationId: ORG_ID, body: { invitees: [invitee] } })).toEqual(results);
    expect(sentBody(1)).toEqual({ invitees: [invitee] });
    expect(call(1)[1]?.signal).toBeUndefined();
  });

  test("withdraws, re-links and resends one invite", async () => {
    routeFetch({
      [`DELETE /api/internal/invites/${INVITE_ID}`]: [json(null, 204)],
      [`POST /api/internal/invites/${INVITE_ID}/share-links`]: [json({ data: { inviteToken: "t%2B" } }, 201)],
      [`POST /api/internal/invites/${INVITE_ID}/emails?organizationId=${ORG_ID}`]: [json(null, 204)],
    });

    await expect(deleteInvite(INVITE_ID)).resolves.toBeUndefined();
    expect(await createInviteShareLink(INVITE_ID)).toEqual({ inviteToken: "t%2B" });
    await expect(resendInvite({ inviteId: INVITE_ID, organizationId: ORG_ID })).resolves.toBeUndefined();
    expect(call(2)[1]?.signal).toBeUndefined();
  });

  test("removes a member, and the caller's own membership to leave", async () => {
    routeFetch({
      [`DELETE /api/internal/members/${USER_ID}?organizationId=${ORG_ID}`]: [json(null, 204)],
      [`DELETE /api/internal/members/me?organizationId=${ORG_ID}`]: [json(null, 204)],
    });

    await expect(deleteMember({ userId: USER_ID, organizationId: ORG_ID })).resolves.toBeUndefined();
    await expect(leaveOrganization(ORG_ID)).resolves.toBeUndefined();
  });

  test("surfaces the server's reason for a refusal", async () => {
    const detail = "Invite already exists";
    routeFetch({
      [`POST /api/internal/invites?organizationId=${ORG_ID}`]: [json({ status: 409, detail }, 409)],
    });

    const failure = inviteMember({ organizationId: ORG_ID, body: invitee });
    await expect(failure).rejects.toBeInstanceOf(V3ApiError);
    await expect(failure).rejects.toMatchObject({ status: 409, detail });
  });
});
