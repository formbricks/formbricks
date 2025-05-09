import { getMembershipByUserIdOrganizationId } from "@/lib/membership/service";
import { Invite, Prisma } from "@prisma/client";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { prisma } from "@formbricks/database";
import {
  DatabaseError,
  InvalidInputError,
  ResourceNotFoundError,
  ValidationError,
} from "@formbricks/types/errors";
import { TInvitee } from "../types/invites";
import { deleteInvite, getInvite, getInvitesByOrganizationId, inviteUser, resendInvite } from "./invite";

vi.mock("@formbricks/database", () => ({
  prisma: {
    invite: {
      findUnique: vi.fn(),
      update: vi.fn(),
      findMany: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      delete: vi.fn(),
    },
    user: {
      findUnique: vi.fn(),
    },
    team: {
      findMany: vi.fn(),
    },
  },
}));
vi.mock("@/lib/cache/invite", () => ({
  inviteCache: { revalidate: vi.fn(), tag: { byOrganizationId: (id) => id, byId: (id) => id } },
}));
vi.mock("@/lib/membership/service", () => ({ getMembershipByUserIdOrganizationId: vi.fn() }));
vi.mock("@/lib/utils/validate", () => ({ validateInputs: vi.fn() }));

const mockInvite: Invite = {
  id: "invite-1",
  email: "test@example.com",
  name: "Test User",
  organizationId: "org-1",
  creatorId: "user-1",
  acceptorId: null,
  role: "member",
  expiresAt: new Date(),
  createdAt: new Date(),
  deprecatedRole: null,
  teamIds: [],
};

describe("resendInvite", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });
  test("returns email and name if invite exists", async () => {
    vi.mocked(prisma.invite.findUnique).mockResolvedValue({ ...mockInvite, creator: {} });
    vi.mocked(prisma.invite.update).mockResolvedValue({ ...mockInvite, organizationId: "org-1" });
    const result = await resendInvite("invite-1");
    expect(result).toEqual({ email: mockInvite.email, name: mockInvite.name });
  });
  test("throws ResourceNotFoundError if invite not found", async () => {
    vi.mocked(prisma.invite.findUnique).mockResolvedValue(null);
    await expect(resendInvite("invite-1")).rejects.toThrow(ResourceNotFoundError);
  });
  test("throws DatabaseError on prisma error", async () => {
    const prismaError = new Prisma.PrismaClientKnownRequestError("db", {
      code: "P2002",
      clientVersion: "1.0.0",
    });
    vi.mocked(prisma.invite.findUnique).mockRejectedValue(prismaError);
    await expect(resendInvite("invite-1")).rejects.toThrow(DatabaseError);
  });

  test("throws error if prisma error", async () => {
    const error = new Error("db");
    vi.mocked(prisma.invite.findUnique).mockRejectedValue(error);
    await expect(resendInvite("invite-1")).rejects.toThrow("db");
  });
});

describe("getInvitesByOrganizationId", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });
  test("returns invites", async () => {
    vi.mocked(prisma.invite.findMany).mockResolvedValue([mockInvite]);
    const result = await getInvitesByOrganizationId("org-1", 1);
    expect(result[0].id).toBe("invite-1");
  });
  test("throws DatabaseError on prisma error", async () => {
    const prismaError = new Prisma.PrismaClientKnownRequestError("db", {
      code: "P2002",
      clientVersion: "1.0.0",
    });
    vi.mocked(prisma.invite.findMany).mockRejectedValue(prismaError);
    await expect(getInvitesByOrganizationId("org-1", 1)).rejects.toThrow(DatabaseError);
  });
  test("throws error if prisma error", async () => {
    const error = new Error("db");
    vi.mocked(prisma.invite.findMany).mockRejectedValue(error);
    await expect(getInvitesByOrganizationId("org-1", 1)).rejects.toThrow("db");
  });
});

describe("inviteUser", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });
  const invitee: TInvitee = { name: "Test", email: "test@example.com", role: "member", teamIds: [] };
  test("creates invite if valid", async () => {
    vi.mocked(prisma.invite.findFirst).mockResolvedValue(null);
    vi.mocked(prisma.user.findUnique).mockResolvedValue(null);
    vi.mocked(prisma.team.findMany).mockResolvedValue([]);
    vi.mocked(prisma.invite.create).mockResolvedValue(mockInvite);
    const result = await inviteUser({ invitee, organizationId: "org-1", currentUserId: "user-1" });
    expect(result).toBe("invite-1");
  });
  test("throws InvalidInputError if invite exists", async () => {
    vi.mocked(prisma.invite.findFirst).mockResolvedValue(mockInvite);
    await expect(inviteUser({ invitee, organizationId: "org-1", currentUserId: "user-1" })).rejects.toThrow(
      InvalidInputError
    );
  });
  test("throws InvalidInputError if user is already a member", async () => {
    vi.mocked(prisma.invite.findFirst).mockResolvedValue(null);
    vi.mocked(prisma.user.findUnique).mockResolvedValue({ id: "user-2" });
    vi.mocked(getMembershipByUserIdOrganizationId).mockResolvedValue({
      accepted: true,
      organizationId: "org1",
      role: "member",
      userId: "user1",
    });
    await expect(inviteUser({ invitee, organizationId: "org-1", currentUserId: "user-1" })).rejects.toThrow(
      InvalidInputError
    );
  });
  test("throws ValidationError if teamIds not unique", async () => {
    await expect(
      inviteUser({
        invitee: { ...invitee, teamIds: ["a", "a"] },
        organizationId: "org-1",
        currentUserId: "user-1",
      })
    ).rejects.toThrow(ValidationError);
  });
  test("throws ValidationError if teamIds invalid", async () => {
    vi.mocked(prisma.invite.findFirst).mockResolvedValue(null);
    vi.mocked(prisma.user.findUnique).mockResolvedValue(null);
    vi.mocked(prisma.team.findMany).mockResolvedValue([]);
    await expect(
      inviteUser({
        invitee: { ...invitee, teamIds: ["a"] },
        organizationId: "org-1",
        currentUserId: "user-1",
      })
    ).rejects.toThrow(ValidationError);
  });
  test("throws DatabaseError on prisma error", async () => {
    const error = new Prisma.PrismaClientKnownRequestError("db", { code: "P2002", clientVersion: "1.0.0" });
    vi.mocked(prisma.invite.findFirst).mockRejectedValue(error);
    await expect(inviteUser({ invitee, organizationId: "org-1", currentUserId: "user-1" })).rejects.toThrow(
      DatabaseError
    );
  });

  test("throws error if prisma error", async () => {
    const error = new Error("db");
    vi.mocked(prisma.invite.findFirst).mockRejectedValue(error);
    await expect(inviteUser({ invitee, organizationId: "org-1", currentUserId: "user-1" })).rejects.toThrow(
      "db"
    );
  });
});

describe("deleteInvite", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });
  test("returns true if deleted", async () => {
    vi.mocked(prisma.invite.delete).mockResolvedValue({ id: "invite-1", organizationId: "org-1" } as any);
    const result = await deleteInvite("invite-1");
    expect(result).toBe(true);
  });
  test("throws ResourceNotFoundError if not found", async () => {
    vi.mocked(prisma.invite.delete).mockResolvedValue(null as any);
    await expect(deleteInvite("invite-1")).rejects.toThrow(ResourceNotFoundError);
  });
  test("throws DatabaseError on prisma error", async () => {
    const error = new Prisma.PrismaClientKnownRequestError("db", { code: "P2002", clientVersion: "1.0.0" });
    vi.mocked(prisma.invite.delete).mockRejectedValue(error);
    await expect(deleteInvite("invite-1")).rejects.toThrow(DatabaseError);
  });

  test("throws error if prisma error", async () => {
    const error = new Error("db");
    vi.mocked(prisma.invite.delete).mockRejectedValue(error);
    await expect(deleteInvite("invite-1")).rejects.toThrow("db");
  });
});

describe("getInvite", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });
  test("returns invite with creator if found", async () => {
    vi.mocked(prisma.invite.findUnique).mockResolvedValue({
      email: "test@example.com",
      creator: { name: "Test" },
    });
    const result = await getInvite("invite-1");
    expect(result).toEqual({ email: "test@example.com", creator: { name: "Test" } });
  });
  test("returns null if not found", async () => {
    vi.mocked(prisma.invite.findUnique).mockResolvedValue(null);
    const result = await getInvite("invite-1");
    expect(result).toBeNull();
  });
  test("throws DatabaseError on prisma error", async () => {
    const error = new Prisma.PrismaClientKnownRequestError("db", { code: "P2002", clientVersion: "1.0.0" });
    vi.mocked(prisma.invite.findUnique).mockRejectedValue(error);
    await expect(getInvite("invite-1")).rejects.toThrow(DatabaseError);
  });

  test("throws error if prisma error", async () => {
    const error = new Error("db");
    vi.mocked(prisma.invite.findUnique).mockRejectedValue(error);
    await expect(getInvite("invite-1")).rejects.toThrow("db");
  });
});
