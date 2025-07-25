import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Session } from "next-auth";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { TOrganization } from "@formbricks/types/organizations";
import { TUser } from "@formbricks/types/user";
import { DeleteAccount } from "./DeleteAccount";

vi.mock("@/modules/account/components/DeleteAccountModal", () => ({
  DeleteAccountModal: ({ open }) =>
    open ? <div data-testid="delete-account-modal">DeleteAccountModal</div> : null,
}));

const mockUser = {
  id: "user1",
  name: "Test User",
  email: "test@example.com",
  notificationSettings: { alert: {}, unsubscribedOrganizationIds: [] },
  twoFactorEnabled: false,
  identityProvider: "email",
  createdAt: new Date(),
  updatedAt: new Date(),
  role: "project_manager",
  objective: "other",
} as unknown as TUser;

const mockSession: Session = {
  user: mockUser,
  expires: new Date(Date.now() + 2 * 86400).toISOString(),
};

const mockOrganizations: TOrganization[] = [
  {
    id: "org1",
    name: "Org 1",
    createdAt: new Date(),
    updatedAt: new Date(),
    billing: {
      stripeCustomerId: "cus_123",
    } as unknown as TOrganization["billing"],
  } as unknown as TOrganization,
];

describe("DeleteAccount", () => {
  afterEach(() => {
    cleanup();
  });

  beforeEach(() => {
    vi.resetAllMocks();
  });

  test("renders correctly and opens modal on click", async () => {
    render(
      <DeleteAccount
        session={mockSession}
        IS_FORMBRICKS_CLOUD={true}
        user={mockUser}
        organizationsWithSingleOwner={[]}
        isMultiOrgEnabled={true}
      />
    );

    expect(screen.getByText("environments.settings.profile.warning_cannot_undo")).toBeInTheDocument();
    const deleteButton = screen.getByText("environments.settings.profile.confirm_delete_my_account");
    expect(deleteButton).toBeEnabled();
    await userEvent.click(deleteButton);
    expect(screen.getByTestId("delete-account-modal")).toBeInTheDocument();
  });

  test("renders null if session is not provided", () => {
    const { container } = render(
      <DeleteAccount
        session={null}
        IS_FORMBRICKS_CLOUD={true}
        user={mockUser}
        organizationsWithSingleOwner={[]}
        isMultiOrgEnabled={true}
      />
    );
    expect(container.firstChild).toBeNull();
  });

  test("enables delete button if multi-org enabled even if user is single owner", () => {
    render(
      <DeleteAccount
        session={mockSession}
        IS_FORMBRICKS_CLOUD={false}
        user={mockUser}
        organizationsWithSingleOwner={mockOrganizations}
        isMultiOrgEnabled={true}
      />
    );
    const deleteButton = screen.getByText("environments.settings.profile.confirm_delete_my_account");
    expect(deleteButton).toBeEnabled();
  });
});
