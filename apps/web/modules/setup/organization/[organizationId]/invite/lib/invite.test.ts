import { getMembershipByUserIdOrganizationId } from "@/lib/membership/service";
import { TInvitee } from "@/modules/setup/organization/[organizationId]/invite/types/invites";
import { Invite, Prisma } from "@prisma/client";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { prisma } from "@formbricks/database";
import { DatabaseError, InvalidInputError } from "@formbricks/types/errors";
import { inviteUser } from "./invite";

vi.mock("@formbricks/database", () => ({
  prisma: {
    invite: {
      findFirst: vi.fn(),
      create: vi.fn(),
    },
    user: {
      findUnique: vi.fn(),
    },
  },
}));

vi.mock("@/lib/membership/service", () => ({
  getMembershipByUserIdOrganizationId: vi.fn(),
}));

const organizationId = "test-organization-id";
const currentUserId = "test-current-user-id";
const invitee: TInvitee = {
  email: "test@example.com",
  name: "Test User",
};

describe("inviteUser", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  test("should create an invite successfully", async () => {
    const mockInvite = {
      id: "test-invite-id",
      organizationId,
      email: invitee.email,
      name: invitee.name,
    } as Invite;
    vi.mocked(prisma.invite.findFirst).mockResolvedValue(null);
    vi.mocked(prisma.user.findUnique).mockResolvedValue(null);
    vi.mocked(prisma.invite.create).mockResolvedValue(mockInvite);

    const result = await inviteUser({ invitee, organizationId, currentUserId });

    expect(prisma.invite.findFirst).toHaveBeenCalledWith({
      where: { email: invitee.email, organizationId },
    });
    expect(prisma.user.findUnique).toHaveBeenCalledWith({ where: { email: invitee.email } });
    expect(prisma.invite.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          email: invitee.email,
          name: invitee.name,
          organization: { connect: { id: organizationId } },
          creator: { connect: { id: currentUserId } },
          acceptor: undefined,
          role: "owner",
          expiresAt: expect.any(Date),
        }),
      })
    );
    expect(result).toBe(mockInvite.id);
  });

  test("should throw InvalidInputError if invite already exists", async () => {
    vi.mocked(prisma.invite.findFirst).mockResolvedValue({ id: "existing-invite-id" } as any);

    await expect(inviteUser({ invitee, organizationId, currentUserId })).rejects.toThrowError(
      new InvalidInputError("Invite already exists")
    );
    expect(prisma.invite.findFirst).toHaveBeenCalledWith({
      where: { email: invitee.email, organizationId },
    });
    expect(prisma.user.findUnique).not.toHaveBeenCalled();
    expect(prisma.invite.create).not.toHaveBeenCalled();
  });

  test("should throw InvalidInputError if user is already a member", async () => {
    const mockUser = { id: "test-user-id", email: invitee.email };
    vi.mocked(prisma.invite.findFirst).mockResolvedValue(null);
    vi.mocked(prisma.user.findUnique).mockResolvedValue(mockUser as any);
    vi.mocked(getMembershipByUserIdOrganizationId).mockResolvedValue({} as any);

    await expect(inviteUser({ invitee, organizationId, currentUserId })).rejects.toThrowError(
      new InvalidInputError("User is already a member of this organization")
    );
    expect(prisma.invite.findFirst).toHaveBeenCalledWith({
      where: { email: invitee.email, organizationId },
    });
    expect(prisma.user.findUnique).toHaveBeenCalledWith({ where: { email: invitee.email } });
    expect(getMembershipByUserIdOrganizationId).toHaveBeenCalledWith(mockUser.id, organizationId);
    expect(prisma.invite.create).not.toHaveBeenCalled();
  });

  test("should create an invite successfully if user exists but is not a member of the organization", async () => {
    const mockUser = { id: "test-user-id", email: invitee.email };
    const mockInvite = {
      id: "test-invite-id",
      organizationId,
      email: invitee.email,
      name: invitee.name,
    } as Invite;
    vi.mocked(prisma.invite.findFirst).mockResolvedValue(null);
    vi.mocked(prisma.user.findUnique).mockResolvedValue(mockUser as any);
    vi.mocked(getMembershipByUserIdOrganizationId).mockResolvedValue(null);
    vi.mocked(prisma.invite.create).mockResolvedValue(mockInvite);

    const result = await inviteUser({ invitee, organizationId, currentUserId });

    expect(prisma.invite.findFirst).toHaveBeenCalledWith({
      where: { email: invitee.email, organizationId },
    });
    expect(prisma.user.findUnique).toHaveBeenCalledWith({ where: { email: invitee.email } });
    expect(getMembershipByUserIdOrganizationId).toHaveBeenCalledWith(mockUser.id, organizationId);
    expect(prisma.invite.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          email: invitee.email,
          name: invitee.name,
          organization: { connect: { id: organizationId } },
          creator: { connect: { id: currentUserId } },
          acceptor: { connect: { id: mockUser.id } },
          role: "owner",
          expiresAt: expect.any(Date),
        }),
      })
    );
    expect(result).toBe(mockInvite.id);
  });

  test("should throw DatabaseError if prisma.invite.create fails", async () => {
    const errorMessage = "Prisma create failed";
    vi.mocked(prisma.invite.findFirst).mockResolvedValue(null);
    vi.mocked(prisma.user.findUnique).mockResolvedValue(null);
    vi.mocked(prisma.invite.create).mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError(errorMessage, { code: "P2021", clientVersion: "test" })
    );

    await expect(inviteUser({ invitee, organizationId, currentUserId })).rejects.toThrowError(
      new DatabaseError(errorMessage)
    );
    expect(prisma.invite.findFirst).toHaveBeenCalledWith({
      where: { email: invitee.email, organizationId },
    });
    expect(prisma.user.findUnique).toHaveBeenCalledWith({ where: { email: invitee.email } });
    expect(prisma.invite.create).toHaveBeenCalled();
  });

  test("should throw generic error if an unknown error occurs", async () => {
    const errorMessage = "Unknown error";
    vi.mocked(prisma.invite.findFirst).mockResolvedValue(null);
    vi.mocked(prisma.user.findUnique).mockResolvedValue(null);
    vi.mocked(prisma.invite.create).mockRejectedValue(new Error(errorMessage));

    await expect(inviteUser({ invitee, organizationId, currentUserId })).rejects.toThrowError(
      new Error(errorMessage)
    );
    expect(prisma.invite.findFirst).toHaveBeenCalledWith({
      where: { email: invitee.email, organizationId },
    });
    expect(prisma.user.findUnique).toHaveBeenCalledWith({ where: { email: invitee.email } });
    expect(prisma.invite.create).toHaveBeenCalled();
  });
});
