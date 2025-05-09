import { CreateMembershipInvite } from "@/modules/auth/signup/types/invites";
import { OrganizationRole, Team, TeamUserRole } from "@prisma/client";

/**
 * Common constants and IDs used across tests
 */
export const MOCK_DATE = new Date("2023-01-01T00:00:00.000Z");

export const MOCK_IDS = {
  // User IDs
  userId: "test-user-id",

  // Team IDs
  teamId: "test-team-id",
  defaultTeamId: "team-123",

  // Organization IDs
  organizationId: "test-org-id",
  defaultOrganizationId: "org-123",

  // Project IDs
  projectId: "test-project-id",
};

/**
 * Mock team data structures
 */
export const MOCK_TEAM: {
  id: string;
  organizationId: string;
  projectTeams: { projectId: string }[];
} = {
  id: MOCK_IDS.teamId,
  organizationId: MOCK_IDS.organizationId,
  projectTeams: [
    {
      projectId: MOCK_IDS.projectId,
    },
  ],
};

export const MOCK_DEFAULT_TEAM: Team = {
  id: MOCK_IDS.defaultTeamId,
  organizationId: MOCK_IDS.defaultOrganizationId,
  name: "Default Team",
  createdAt: MOCK_DATE,
  updatedAt: MOCK_DATE,
};

/**
 * Mock membership data
 */
export const MOCK_TEAM_USER = {
  teamId: MOCK_IDS.teamId,
  userId: MOCK_IDS.userId,
  role: "admin" as TeamUserRole,
  createdAt: MOCK_DATE,
  updatedAt: MOCK_DATE,
};

export const MOCK_DEFAULT_TEAM_USER = {
  teamId: MOCK_IDS.defaultTeamId,
  userId: MOCK_IDS.userId,
  role: "admin" as TeamUserRole,
  createdAt: MOCK_DATE,
  updatedAt: MOCK_DATE,
};

/**
 * Mock invitation data
 */
export const MOCK_INVITE: CreateMembershipInvite = {
  organizationId: MOCK_IDS.organizationId,
  role: "owner" as OrganizationRole,
  teamIds: [MOCK_IDS.teamId],
};

export const MOCK_ORGANIZATION_MEMBERSHIP = {
  userId: MOCK_IDS.userId,
  role: "owner" as OrganizationRole,
  organizationId: MOCK_IDS.defaultOrganizationId,
  accepted: true,
};

/**
 * Factory functions for creating test data with custom overrides
 */
export const createMockTeam = (overrides = {}) => ({
  ...MOCK_TEAM,
  ...overrides,
});

export const createMockTeamUser = (overrides = {}) => ({
  ...MOCK_TEAM_USER,
  ...overrides,
});

export const createMockInvite = (overrides = {}) => ({
  ...MOCK_INVITE,
  ...overrides,
});
