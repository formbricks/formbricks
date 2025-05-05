import { InviteWithCreator } from "@/modules/organization/settings/teams/types/invites";
import { OrganizationRole, TeamUserRole } from "@prisma/client";
import { Session } from "next-auth";
import { z } from "zod";
import { ZInvite } from "@formbricks/database/zod/invites";
import { TMembership } from "@formbricks/types/memberships";
import { TOrganization } from "@formbricks/types/organizations";
import { TUser } from "@formbricks/types/user";

// Mock IDs
export const mockUserId = "pltrxzyc5ej4n7v4yupet0j9";
export const mockOtherUserId = "bfn3tytw0puawppgo6ppooag";
export const mockManagerUserId = "mqn6li7zxcpteaq92dwv56ht";
export const mockInviteId = "dc0b6ea6-bb65-4a22-88e1-847df2e85af4";
export const mockOrganizationId = "pvay6sljkaqfsb199gcacebb";
export const mockTeamId = "uj7bo5b2smv559v5i2d7qi2q";

// Mock names and emails
export const mockUserName = "Test User";
export const mockUserEmail = "test@example.com";
export const mockInviteeName = "Invitee User";
export const mockInviteeEmail = "invitee@example.com";

// Mock user
export const mockUser: TUser = {
  id: mockUserId,
  name: "Test User",
  email: "test@example.com",
  emailVerified: new Date(),
  createdAt: new Date(),
  updatedAt: new Date(),
  identityProvider: "email",
  twoFactorEnabled: false,
  objective: null,
  notificationSettings: {
    alert: {},
    weeklySummary: {},
  },
  locale: "en-US",
  imageUrl: null,
  role: null,
  whitelist: false,
};

// Mock session
export const mockSession: Session = {
  user: {
    id: mockUserId,
  },
  expires: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
};

// Mock organization
export const createMockOrganization = (plan: TOrganization["billing"]["plan"]): TOrganization => ({
  id: mockOrganizationId,
  name: "Test Organization",
  billing: {
    plan,
    period: "monthly",
    periodStart: new Date(),
    stripeCustomerId: "stripe-customer-id",
    limits: {
      monthly: {
        responses: 1000,
        miu: 1000,
      },
      projects: 1,
    },
  },
  createdAt: new Date(),
  updatedAt: new Date(),
});

export const mockOrganization = createMockOrganization("scale");
export const mockOrganizationFree = createMockOrganization("startup");

// Mock input objects for actions
export const mockDeleteInviteInput = {
  inviteId: mockInviteId,
  organizationId: mockOrganizationId,
};

export const mockCreateInviteTokenInput = {
  inviteId: mockInviteId,
};

export const mockDeleteMembershipInput = {
  userId: mockOtherUserId,
  organizationId: mockOrganizationId,
};

export const mockResendInviteInput = {
  inviteId: mockInviteId,
  organizationId: mockOrganizationId,
};

export const mockInviteUserInput = {
  organizationId: mockOrganizationId,
  email: mockInviteeEmail,
  name: mockInviteeName,
  role: OrganizationRole.member,
  teamIds: [mockTeamId],
};

export const mockLeaveOrganizationInput = {
  organizationId: mockOrganizationId,
};

// Mock memberships - correctly typed based on TMembership
export const mockOwnerMembership: TMembership = {
  organizationId: mockOrganizationId,
  userId: mockUserId,
  accepted: true,
  role: "owner",
};

export const mockManagerMembership: TMembership = {
  organizationId: mockOrganizationId,
  userId: mockUserId,
  accepted: true,
  role: "manager",
};

export const mockMemberMembership: TMembership = {
  organizationId: mockOrganizationId,
  userId: mockUserId,
  accepted: true,
  role: "member",
};

// Mock invites - using ZInvite type
export const mockInvite: z.infer<typeof ZInvite> = {
  id: mockInviteId,
  email: mockInviteeEmail,
  name: mockInviteeName,
  organizationId: mockOrganizationId,
  creatorId: mockUserId,
  acceptorId: null,
  createdAt: new Date(),
  expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days from now
  role: "member",
  teamIds: [mockTeamId],
};

// Mock for invite with creator data (as returned by getInvite)
export const mockInviteWithCreator: InviteWithCreator = {
  email: mockInviteeEmail,
  creator: {
    name: mockUserName,
  },
};

export const mockResendInviteResponse = {
  email: mockInviteeEmail,
  name: mockInviteeName,
};

// Mock deleted team memberships with correct types
export const mockDeletedMembership = {
  role: TeamUserRole.admin,
  userId: mockOtherUserId,
  teamId: mockTeamId,
};

export const mockDeletedMemberMembership = {
  role: TeamUserRole.contributor,
  userId: mockUserId,
  teamId: mockTeamId,
};

// Mock tokens
export const mockInviteToken = "mock-token";

// Mock access flags
export const mockOwnerAccessFlags = {
  isOwner: true,
  isManager: false,
  isBilling: false,
  isMember: false,
};

export const mockNonOwnerAccessFlags = {
  isOwner: false,
  isManager: true,
  isBilling: false,
  isMember: false,
};

// Mock membership arrays
export const mockMultipleMemberships = [
  mockOwnerMembership,
  {
    organizationId: "other-org-id",
    userId: mockUserId,
    accepted: true,
    role: "member",
  } as TMembership,
];

export const mockSingleMembership = [mockOwnerMembership];
