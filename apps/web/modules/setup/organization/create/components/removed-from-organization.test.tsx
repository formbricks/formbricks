import { DeleteAccountModal } from "@/modules/account/components/DeleteAccountModal";
import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, test, vi } from "vitest";
import { TUser } from "@formbricks/types/user";
import { RemovedFromOrganization } from "./removed-from-organization";

// Mock DeleteAccountModal
vi.mock("@/modules/account/components/DeleteAccountModal", () => ({
  DeleteAccountModal: vi.fn(({ open, setOpen, user, isFormbricksCloud, organizationsWithSingleOwner }) => {
    if (!open) return null;
    return (
      <div data-testid="delete-account-modal">
        <p>User: {user.email}</p>
        <p>IsFormbricksCloud: {isFormbricksCloud.toString()}</p>
        <p>OrgsWithSingleOwner: {organizationsWithSingleOwner.length}</p>
        <button onClick={() => setOpen(false)}>Close Modal</button>
      </div>
    );
  }),
}));

// Mock Alert components
vi.mock("@/modules/ui/components/alert", async () => {
  const actual = await vi.importActual("@/modules/ui/components/alert");
  return {
    ...actual,
    Alert: ({ children, variant }) => (
      <div data-testid="alert" data-variant={variant}>
        {children}
      </div>
    ),
    AlertTitle: ({ children }) => <div data-testid="alert-title">{children}</div>,
    AlertDescription: ({ children }) => <div data-testid="alert-description">{children}</div>,
  };
});

// Mock Button component
vi.mock("@/modules/ui/components/button", () => ({
  Button: vi.fn(({ children, onClick }) => (
    <button onClick={onClick} data-testid="button">
      {children}
    </button>
  )),
}));

// Mock useTranslate from @tolgee/react
vi.mock("@tolgee/react", () => ({
  useTranslate: () => ({
    t: (key: string) => key,
  }),
}));

const mockUser = {
  id: "user-123",
  name: "Test User",
  email: "test@example.com",
  imageUrl: null,
  twoFactorEnabled: false,
  identityProvider: "email",
  createdAt: new Date(),
  updatedAt: new Date(),
  notificationSettings: {
    alert: {},
  },
  role: "other",
} as TUser;

describe("RemovedFromOrganization", () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  test("renders correctly with initial content", () => {
    render(<RemovedFromOrganization user={mockUser} isFormbricksCloud={true} />);
    expect(screen.getByText("setup.organization.create.no_membership_found")).toBeInTheDocument();
    expect(screen.getByText("setup.organization.create.no_membership_found_description")).toBeInTheDocument();
    expect(screen.getByText("setup.organization.create.delete_account_description")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "setup.organization.create.delete_account" })
    ).toBeInTheDocument();
    expect(screen.queryByTestId("delete-account-modal")).not.toBeInTheDocument();
  });

  test("opens DeleteAccountModal when 'Delete Account' button is clicked", async () => {
    render(<RemovedFromOrganization user={mockUser} isFormbricksCloud={false} />);
    const deleteButton = screen.getByRole("button", { name: "setup.organization.create.delete_account" });
    await userEvent.click(deleteButton);
    const modal = screen.getByTestId("delete-account-modal");
    expect(modal).toBeInTheDocument();
    expect(modal).toHaveTextContent(`User: ${mockUser.email}`);
    expect(modal).toHaveTextContent("IsFormbricksCloud: false");
    expect(modal).toHaveTextContent("OrgsWithSingleOwner: 0");
    // Only check the last call, which is the open=true call
    const lastCall = vi.mocked(DeleteAccountModal).mock.calls.at(-1)?.[0];
    expect(lastCall).toMatchObject({
      open: true,
      user: mockUser,
      isFormbricksCloud: false,
      organizationsWithSingleOwner: [],
    });
  });

  test("passes isFormbricksCloud prop correctly to DeleteAccountModal", async () => {
    render(<RemovedFromOrganization user={mockUser} isFormbricksCloud={true} />);
    const deleteButton = screen.getByRole("button", { name: "setup.organization.create.delete_account" });
    await userEvent.click(deleteButton);
    const modal = screen.getByTestId("delete-account-modal");
    expect(modal).toBeInTheDocument();
    expect(modal).toHaveTextContent("IsFormbricksCloud: true");
    const lastCall = vi.mocked(DeleteAccountModal).mock.calls.at(-1)?.[0];
    expect(lastCall).toMatchObject({
      open: true,
      user: mockUser,
      isFormbricksCloud: true,
      organizationsWithSingleOwner: [],
    });
  });
});
