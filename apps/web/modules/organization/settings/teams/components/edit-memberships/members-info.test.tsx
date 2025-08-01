import { getAccessFlags } from "@/lib/membership/utils";
import { isInviteExpired } from "@/modules/organization/settings/teams/lib/utils";
import { TInvite } from "@/modules/organization/settings/teams/types/invites";
import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vitest";
import { TMember } from "@formbricks/types/memberships";
import { TOrganization } from "@formbricks/types/organizations";
import { MembersInfo } from "./members-info";

vi.mock("@/modules/ee/role-management/components/edit-membership-role", () => ({
  EditMembershipRole: (props: any) => (
    <div data-testid="edit-membership-role" data-props={JSON.stringify(props)} />
  ),
}));

vi.mock("@/modules/organization/settings/teams/components/edit-memberships/member-actions", () => ({
  MemberActions: (props: any) => <div data-testid="member-actions" data-props={JSON.stringify(props)} />,
}));

vi.mock("@/modules/ui/components/badge", () => ({
  Badge: (props: any) => <div data-testid={props["data-testid"] ?? "badge"}>{props.text}</div>,
}));
vi.mock("@/modules/ui/components/tooltip", () => ({
  TooltipRenderer: (props: any) => <div data-testid="tooltip">{props.children}</div>,
}));
vi.mock("@/modules/organization/settings/teams/lib/utils", () => ({
  isInviteExpired: vi.fn(() => false),
}));
vi.mock("@/lib/membership/utils", () => ({
  getAccessFlags: vi.fn(() => ({ isOwner: false, isManager: false })),
}));
vi.mock("@tolgee/react", () => ({
  useTranslate: () => ({ t: (key: string) => key }),
}));

const org: TOrganization = {
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
const member: TMember = {
  userId: "user-1",
  name: "User One",
  email: "user1@example.com",
  role: "owner",
  accepted: true,
  isActive: true,
};
const inactiveMember: TMember = {
  ...member,
  isActive: false,
  role: "member",
  userId: "user-2",
  email: "user2@example.com",
};
const invite: TInvite = {
  id: "invite-1",
  email: "invite@example.com",
  name: "Invitee",
  role: "member",
  expiresAt: new Date(),
  createdAt: new Date(),
};

describe("MembersInfo", () => {
  afterEach(() => {
    cleanup();
  });

  test("renders member info and EditMembershipRole when isAccessControlAllowed", () => {
    render(
      <MembersInfo
        organization={org}
        members={[member]}
        invites={[]}
        currentUserRole="owner"
        currentUserId="user-1"
        isAccessControlAllowed={true}
        isFormbricksCloud={true}
        isUserManagementDisabledFromUi={false}
      />
    );
    expect(screen.getByText("User One")).toBeInTheDocument();
    expect(screen.getByText("user1@example.com")).toBeInTheDocument();
    expect(screen.getByTestId("edit-membership-role")).toBeInTheDocument();
    expect(screen.getByTestId("badge")).toHaveTextContent("Active");
    expect(screen.getByTestId("member-actions")).toBeInTheDocument();
  });

  test("renders badge as Inactive for inactive member", () => {
    render(
      <MembersInfo
        organization={org}
        members={[inactiveMember]}
        invites={[]}
        currentUserRole="owner"
        currentUserId="user-1"
        isAccessControlAllowed={true}
        isFormbricksCloud={true}
        isUserManagementDisabledFromUi={false}
      />
    );
    expect(screen.getByTestId("badge")).toHaveTextContent("Inactive");
  });

  test("renders invite as Pending with tooltip if not expired", () => {
    render(
      <MembersInfo
        organization={org}
        members={[]}
        invites={[invite]}
        currentUserRole="owner"
        currentUserId="user-1"
        isAccessControlAllowed={true}
        isFormbricksCloud={true}
        isUserManagementDisabledFromUi={false}
      />
    );
    expect(screen.getByTestId("tooltip")).toBeInTheDocument();
    expect(screen.getByTestId("badge")).toHaveTextContent("Pending");
  });

  test("renders invite as Expired if isInviteExpired returns true", () => {
    vi.mocked(isInviteExpired).mockReturnValueOnce(true);
    render(
      <MembersInfo
        organization={org}
        members={[]}
        invites={[invite]}
        currentUserRole="owner"
        currentUserId="user-1"
        isAccessControlAllowed={true}
        isFormbricksCloud={true}
        isUserManagementDisabledFromUi={false}
      />
    );
    expect(screen.getByTestId("expired-badge")).toHaveTextContent("Expired");
  });

  test("does not render EditMembershipRole if isAccessControlAllowed is false", () => {
    render(
      <MembersInfo
        organization={org}
        members={[member]}
        invites={[]}
        currentUserRole="owner"
        currentUserId="user-1"
        isAccessControlAllowed={false}
        isFormbricksCloud={true}
        isUserManagementDisabledFromUi={false}
      />
    );
    expect(screen.queryByTestId("edit-membership-role")).not.toBeInTheDocument();
  });

  test("does not render MemberActions if isUserManagementDisabledFromUi is true", () => {
    render(
      <MembersInfo
        organization={org}
        members={[member]}
        invites={[]}
        currentUserRole="owner"
        currentUserId="user-1"
        isAccessControlAllowed={true}
        isFormbricksCloud={true}
        isUserManagementDisabledFromUi={true}
      />
    );
    expect(screen.queryByTestId("member-actions")).not.toBeInTheDocument();
  });

  test("showDeleteButton returns correct values for different roles and invite/member types", () => {
    vi.mocked(getAccessFlags).mockReturnValueOnce({
      isOwner: true,
      isManager: false,
      isBilling: false,
      isMember: false,
    });
    render(
      <MembersInfo
        organization={org}
        members={[]}
        invites={[invite]}
        currentUserRole="owner"
        currentUserId="user-1"
        isAccessControlAllowed={true}
        isFormbricksCloud={true}
        isUserManagementDisabledFromUi={false}
      />
    );
    expect(screen.getByTestId("member-actions")).toBeInTheDocument();
  });
});
