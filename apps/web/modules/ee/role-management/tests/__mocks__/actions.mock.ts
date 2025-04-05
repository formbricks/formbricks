import { TInviteUpdateInput } from "@/modules/ee/role-management/types/invites";
import { Session } from "next-auth";
import { TMembership, TMembershipUpdateInput } from "@formbricks/types/memberships";
import { TOrganization, TOrganizationBillingPlan } from "@formbricks/types/organizations";
import { TUser } from "@formbricks/types/user";

// Common mock IDs
export const mockOrganizationId = "cblt7dwr7d0hvdifl4iw6d5x";
export const mockUserId = "wl43gybf3pxmqqx3fcmsk8eb";
export const mockInviteId = "dc0b6ea6-bb65-4a22-88e1-847df2e85af4";
export const mockTargetUserId = "vevt9qm7sqmh44e3za6a2vzd";

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
  lastLoginAt: new Date(),
  isActive: true,
};

// Mock session
export const mockSession: Session = {
  user: {
    id: mockUserId,
  },
  expires: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
};

// Mock organizations
export const createMockOrganization = (plan: TOrganizationBillingPlan): TOrganization => ({
  id: mockOrganizationId,
  name: "Test Organization",
  createdAt: new Date(),
  updatedAt: new Date(),
  isAIEnabled: false,
  billing: {
    stripeCustomerId: null,
    plan,
    period: "monthly",
    periodStart: new Date(),
    limits: {
      projects: plan === "free" ? 3 : null,
      monthly: {
        responses: plan === "free" ? 1500 : null,
        miu: plan === "free" ? 2000 : null,
      },
    },
  },
});

export const mockOrganizationFree = createMockOrganization("free");
export const mockOrganizationStartup = createMockOrganization("startup");
export const mockOrganizationScale = createMockOrganization("scale");

// Mock membership data
export const createMockMembership = (role: TMembership["role"]): TMembership => ({
  userId: mockUserId,
  organizationId: mockOrganizationId,
  role,
  accepted: true,
});

export const mockMembershipMember = createMockMembership("member");
export const mockMembershipManager = createMockMembership("manager");
export const mockMembershipOwner = createMockMembership("owner");

// Mock data payloads
export const mockInviteDataMember: TInviteUpdateInput = { role: "member" };
export const mockInviteDataOwner: TInviteUpdateInput = { role: "owner" };
export const mockInviteDataBilling: TInviteUpdateInput = { role: "billing" };

export const mockMembershipUpdateMember: TMembershipUpdateInput = { role: "member" };
export const mockMembershipUpdateOwner: TMembershipUpdateInput = { role: "owner" };
export const mockMembershipUpdateBilling: TMembershipUpdateInput = { role: "billing" };

// Mock input objects for actions
export const mockUpdateInviteInput = {
  inviteId: mockInviteId,
  organizationId: mockOrganizationId,
  data: mockInviteDataMember,
};

export const mockUpdateMembershipInput = {
  userId: mockTargetUserId,
  organizationId: mockOrganizationId,
  data: mockMembershipUpdateMember,
};

// Mock responses
export const mockUpdatedMembership: TMembership = {
  userId: mockTargetUserId,
  organizationId: mockOrganizationId,
  role: "member",
  accepted: true,
};
