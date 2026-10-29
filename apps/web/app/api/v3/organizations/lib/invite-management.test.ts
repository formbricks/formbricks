import { beforeEach, describe, expect, test, vi } from "vitest";
import { prisma } from "@formbricks/database";
import { skipV3AuditLog } from "@/app/api/v3/lib/audit";
import { applyRateLimit } from "@/modules/core/rate-limit/helpers";
import { sendInviteMemberEmail } from "@/modules/email";
import { deleteInvite, refreshInviteExpiration } from "@/modules/organization/settings/teams/lib/invite";
import {
  reserveInviteRateLimit,
  settleInviteRateLimit,
} from "@/modules/organization/settings/teams/lib/invite-rate-limit";
import { requireV3UserManagement } from "./access";
import { deleteV3OrganizationInvite, resendV3OrganizationInvite } from "./invite-management";

const constants = vi.hoisted(() => ({ INVITE_DISABLED: false }));

vi.mock("server-only", () => ({}));
vi.mock("@formbricks/logger", () => ({
  logger: { withContext: vi.fn(() => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn() })) },
}));
vi.mock("@formbricks/database", () => ({ prisma: { invite: { findFirst: vi.fn() } } }));
vi.mock("@/app/api/v3/lib/audit", () => ({ skipV3AuditLog: vi.fn() }));
vi.mock("@/lib/constants", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/constants")>()),
  get INVITE_DISABLED() {
    return constants.INVITE_DISABLED;
  },
}));
vi.mock("@/modules/core/rate-limit/helpers", () => ({ applyRateLimit: vi.fn() }));
vi.mock("@/modules/email", () => ({ sendInviteMemberEmail: vi.fn() }));
vi.mock("@/modules/organization/settings/teams/lib/invite", () => ({
  deleteInvite: vi.fn(),
  refreshInviteExpiration: vi.fn(),
}));
vi.mock("@/modules/organization/settings/teams/lib/invite-rate-limit", () => ({
  reserveInviteRateLimit: vi.fn(),
  settleInviteRateLimit: vi.fn(),
}));
vi.mock("./access", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./access")>()),
  requireV3UserManagement: vi.fn(),
}));

const organizationId = "tz4a98xxat96iws9zmbrgj3a";
const inviteId = "b4f1c0de-0000-4000-8000-000000000001";
const base = {
  organizationId,
  inviteId,
  authentication: { user: { id: "user_actor" } } as never,
  requestId: "req_1",
  instance: "/api/mcp",
};
const invite = (role = "member") => ({
  id: inviteId,
  email: "new@example.com",
  name: "Nora",
  role,
  expiresAt: new Date("2026-06-01T00:00:00Z"),
  creator: { name: "Olivia" },
});

beforeEach(() => {
  vi.resetAllMocks();
  constants.INVITE_DISABLED = false;
  vi.mocked(requireV3UserManagement).mockResolvedValue({ userId: "user_actor", role: "owner" });
  vi.mocked(prisma.invite.findFirst).mockResolvedValue(invite() as never);
});

describe("deleteV3OrganizationInvite", () => {
  test("looks the invite up inside the organization, so another tenant's invite id is a miss", async () => {
    vi.mocked(prisma.invite.findFirst).mockResolvedValue(null);

    const response = await deleteV3OrganizationInvite({ ...base, confirm: true });

    expect(prisma.invite.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: inviteId, organizationId } })
    );
    expect(response.status).toBe(403);
    expect((await response.json()).detail).toBe("You are not authorized to access this resource");
    expect(deleteInvite).not.toHaveBeenCalled();
  });

  test("without confirm it previews, deletes nothing and audits nothing", async () => {
    const auditLog = {};

    const response = await deleteV3OrganizationInvite({ ...base, auditLog: auditLog as never });

    expect((await response.json()).data).toMatchObject({ status: "preview", inviteId, role: "member" });
    expect(deleteInvite).not.toHaveBeenCalled();
    expect(skipV3AuditLog).toHaveBeenCalledWith(auditLog);
  });

  test("with confirm it deletes the invite and audits what it was", async () => {
    const auditLog: Record<string, unknown> = {};

    const response = await deleteV3OrganizationInvite({
      ...base,
      confirm: true,
      auditLog: auditLog as never,
    });

    expect((await response.json()).data.status).toBe("deleted");
    expect(deleteInvite).toHaveBeenCalledExactlyOnceWith(inviteId);
    expect(applyRateLimit).toHaveBeenCalled();
    expect(auditLog).toMatchObject({
      organizationId,
      targetId: inviteId,
      oldObject: expect.objectContaining({ role: "member" }),
    });
  });

  test("a manager cannot delete an invite for the owner role", async () => {
    vi.mocked(requireV3UserManagement).mockResolvedValue({ userId: "user_actor", role: "manager" });
    vi.mocked(prisma.invite.findFirst).mockResolvedValue(invite("owner") as never);

    const response = await deleteV3OrganizationInvite({ ...base, confirm: true });

    expect(response.status).toBe(403);
    expect(deleteInvite).not.toHaveBeenCalled();
  });

  test("a refused principal never reaches the lookup", async () => {
    vi.mocked(requireV3UserManagement).mockResolvedValue(new Response(null, { status: 403 }));

    const response = await deleteV3OrganizationInvite({ ...base, confirm: true });

    expect(response.status).toBe(403);
    expect(prisma.invite.findFirst).not.toHaveBeenCalled();
  });
});

describe("resendV3OrganizationInvite", () => {
  beforeEach(() => {
    vi.mocked(reserveInviteRateLimit).mockResolvedValue("reservation" as never);
    vi.mocked(refreshInviteExpiration).mockResolvedValue({
      expiresAt: new Date("2026-06-08T00:00:00Z"),
    } as never);
    vi.mocked(sendInviteMemberEmail).mockResolvedValue(true);
  });

  test("refreshes the expiry, mails again as the original inviter and says so", async () => {
    const auditLog: Record<string, unknown> = {};

    const response = await resendV3OrganizationInvite({ ...base, auditLog: auditLog as never });

    expect((await response.json()).data).toEqual({
      status: "resent",
      organizationId,
      inviteId,
      role: "member",
      expiresAt: "2026-06-08T00:00:00.000Z",
      emailSent: true,
      message: "Invite resent.",
    });
    expect(sendInviteMemberEmail).toHaveBeenCalledWith(
      inviteId,
      "new@example.com",
      "Olivia",
      "Nora",
      organizationId
    );
    expect(settleInviteRateLimit).toHaveBeenCalledWith("reservation", 1);
    expect(auditLog).toMatchObject({
      organizationId,
      targetId: inviteId,
      oldObject: { expiresAt: new Date("2026-06-01T00:00:00Z") },
      newObject: { expiresAt: new Date("2026-06-08T00:00:00Z") },
    });
  });

  test("a broken mail setup still answers 200 with emailSent false", async () => {
    vi.mocked(sendInviteMemberEmail).mockRejectedValue(new Error("smtp down"));

    const response = await resendV3OrganizationInvite(base);

    expect(response.status).toBe(200);
    expect((await response.json()).data).toMatchObject({ emailSent: false });
  });

  test("a failed refresh gives the reserved rate limit back and answers an error", async () => {
    vi.mocked(refreshInviteExpiration).mockRejectedValue(new Error("db"));

    const response = await resendV3OrganizationInvite(base);

    expect(response.status).toBe(500);
    expect(settleInviteRateLimit).toHaveBeenCalledWith("reservation", 0);
    expect(sendInviteMemberEmail).not.toHaveBeenCalled();
  });

  test("is refused when invites are disabled, before any lookup", async () => {
    constants.INVITE_DISABLED = true;

    const response = await resendV3OrganizationInvite(base);

    expect(response.status).toBe(403);
    expect(requireV3UserManagement).not.toHaveBeenCalled();
  });

  test("another organization's invite id is the hidden 403, and a manager cannot resend an owner invite", async () => {
    vi.mocked(prisma.invite.findFirst).mockResolvedValue(null);
    expect((await resendV3OrganizationInvite(base)).status).toBe(403);

    vi.mocked(requireV3UserManagement).mockResolvedValue({ userId: "user_actor", role: "manager" });
    vi.mocked(prisma.invite.findFirst).mockResolvedValue(invite("owner") as never);
    expect((await resendV3OrganizationInvite(base)).status).toBe(403);
    expect(refreshInviteExpiration).not.toHaveBeenCalled();
  });
});
