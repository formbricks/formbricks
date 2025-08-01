import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vitest";
import { TOrganization } from "@formbricks/types/organizations";
import { EditMemberships } from "./edit-memberships";

vi.mock("@/modules/organization/settings/teams/components/edit-memberships/members-info", () => ({
  MembersInfo: (props: any) => <div data-testid="members-info" data-props={JSON.stringify(props)} />,
}));

vi.mock("@/modules/organization/settings/teams/lib/invite", () => ({
  getInvitesByOrganizationId: vi.fn(async () => [
    {
      id: "invite-1",
      email: "invite@example.com",
      name: "Invitee",
      role: "member",
      expiresAt: new Date(),
      createdAt: new Date(),
    },
  ]),
}));

vi.mock("@/modules/organization/settings/teams/lib/membership", () => ({
  getMembershipByOrganizationId: vi.fn(async () => [
    {
      userId: "user-1",
      name: "User One",
      email: "user1@example.com",
      role: "owner",
      accepted: true,
      isActive: true,
    },
  ]),
}));

vi.mock("@/lib/constants", () => ({
  IS_FORMBRICKS_CLOUD: 0,
}));

vi.mock("@/tolgee/server", () => ({
  getTranslate: async () => (key: string) => key,
}));

const mockOrg: TOrganization = {
  id: "org-1",
  name: "Test Org",
  createdAt: new Date(),
  updatedAt: new Date(),
  billing: {
    plan: "free",
    period: "monthly",
    periodStart: new Date(),
    stripeCustomerId: null,
    limits: { monthly: { responses: 100, miu: 100 }, projects: 1 },
  },
  isAIEnabled: false,
};

describe("EditMemberships", () => {
  afterEach(() => {
    cleanup();
  });

  test("renders all table headers and MembersInfo when role is present", async () => {
    const ui = await EditMemberships({
      organization: mockOrg,
      currentUserId: "user-1",
      role: "owner",
      isAccessControlAllowed: true,
      isUserManagementDisabledFromUi: false,
    });
    render(ui);
    expect(screen.getByText("common.full_name")).toBeInTheDocument();
    expect(screen.getByText("common.email")).toBeInTheDocument();
    expect(screen.getByText("common.role")).toBeInTheDocument();
    expect(screen.getByText("common.status")).toBeInTheDocument();
    expect(screen.getByText("common.actions")).toBeInTheDocument();
    expect(screen.getByTestId("members-info")).toBeInTheDocument();
    const props = JSON.parse(screen.getByTestId("members-info").getAttribute("data-props")!);
    expect(props.organization.id).toBe("org-1");
    expect(props.currentUserId).toBe("user-1");
    expect(props.currentUserRole).toBe("owner");
    expect(props.isAccessControlAllowed).toBe(true);
    expect(props.isUserManagementDisabledFromUi).toBe(false);
    expect(Array.isArray(props.invites)).toBe(true);
    expect(Array.isArray(props.members)).toBe(true);
  });

  test("does not render role/actions columns if isAccessControlAllowed or isUserManagementDisabledFromUi is false", async () => {
    const ui = await EditMemberships({
      organization: mockOrg,
      currentUserId: "user-1",
      role: "member",
      isAccessControlAllowed: false,
      isUserManagementDisabledFromUi: true,
    });
    render(ui);
    expect(screen.getByText("common.full_name")).toBeInTheDocument();
    expect(screen.getByText("common.email")).toBeInTheDocument();
    expect(screen.queryByText("common.role")).not.toBeInTheDocument();
    expect(screen.getByText("common.status")).toBeInTheDocument();
    expect(screen.queryByText("common.actions")).not.toBeInTheDocument();
    expect(screen.getByTestId("members-info")).toBeInTheDocument();
  });

  test("does not render MembersInfo if role is falsy", async () => {
    const ui = await EditMemberships({
      organization: mockOrg,
      currentUserId: "user-1",
      role: undefined as any,
      isAccessControlAllowed: true,
      isUserManagementDisabledFromUi: false,
    });
    render(ui);
    expect(screen.queryByTestId("members-info")).not.toBeInTheDocument();
  });
});
