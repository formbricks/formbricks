import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vitest";
import { TOrganization } from "@formbricks/types/organizations";
import { TUser } from "@formbricks/types/user";
import * as actions from "./actions";
import { DeleteAccountModal } from "./index";

// Mock constants that this test needs
vi.mock("@/lib/constants", () => ({
  IS_FORMBRICKS_CLOUD: false,
  WEBAPP_URL: "http://localhost:3000",
}));

// Mock server actions that this test needs
vi.mock("@/modules/auth/actions/sign-out", () => ({
  logSignOutAction: vi.fn().mockResolvedValue(undefined),
}));

// Mock our useSignOut hook
const mockSignOut = vi.fn();
vi.mock("@/modules/auth/hooks/use-sign-out", () => ({
  useSignOut: () => ({
    signOut: mockSignOut,
  }),
}));

vi.mock("./actions", () => ({
  deleteUserAction: vi.fn(),
}));

describe("DeleteAccountModal", () => {
  const mockUser: TUser = {
    email: "test@example.com",
  } as TUser;

  const mockOrgs: TOrganization[] = [{ name: "Org1" }, { name: "Org2" }] as TOrganization[];

  const mockSetOpen = vi.fn();

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  test("renders modal with correct props", () => {
    render(
      <DeleteAccountModal
        open={true}
        setOpen={mockSetOpen}
        user={mockUser}
        isFormbricksCloud={false}
        organizationsWithSingleOwner={mockOrgs}
      />
    );

    expect(screen.getByText("Org1")).toBeInTheDocument();
    expect(screen.getByText("Org2")).toBeInTheDocument();
  });

  test("disables delete button when email does not match", () => {
    render(
      <DeleteAccountModal
        open={true}
        setOpen={mockSetOpen}
        user={mockUser}
        isFormbricksCloud={false}
        organizationsWithSingleOwner={[]}
      />
    );

    const input = screen.getByRole("textbox");
    fireEvent.change(input, { target: { value: "wrong@example.com" } });
    expect(input).toHaveValue("wrong@example.com");
  });

  test("allows account deletion flow (non-cloud)", async () => {
    const deleteUserAction = vi
      .spyOn(actions, "deleteUserAction")
      .mockResolvedValue("deleted-user-id" as any); // the return doesn't matter here

    render(
      <DeleteAccountModal
        open={true}
        setOpen={mockSetOpen}
        user={mockUser}
        isFormbricksCloud={false}
        organizationsWithSingleOwner={[]}
      />
    );

    const input = screen.getByTestId("deleteAccountConfirmation");
    fireEvent.change(input, { target: { value: mockUser.email } });

    const form = screen.getByTestId("deleteAccountForm");
    fireEvent.submit(form);

    await waitFor(() => {
      expect(deleteUserAction).toHaveBeenCalled();
      expect(mockSignOut).toHaveBeenCalledWith({
        reason: "account_deletion",
        redirect: true,
        callbackUrl: "/auth/login",
      });
      expect(mockSetOpen).toHaveBeenCalledWith(false);
    });
  });

  test("allows account deletion flow (cloud)", async () => {
    const deleteUserAction = vi
      .spyOn(actions, "deleteUserAction")
      .mockResolvedValue("deleted-user-id" as any); // the return doesn't matter here

    Object.defineProperty(window, "location", {
      writable: true,
      value: { replace: vi.fn() },
    });

    render(
      <DeleteAccountModal
        open={true}
        setOpen={mockSetOpen}
        user={mockUser}
        isFormbricksCloud={true}
        organizationsWithSingleOwner={[]}
      />
    );

    const input = screen.getByTestId("deleteAccountConfirmation");
    fireEvent.change(input, { target: { value: mockUser.email } });

    const form = screen.getByTestId("deleteAccountForm");
    fireEvent.submit(form);

    await waitFor(() => {
      expect(deleteUserAction).toHaveBeenCalled();
      expect(mockSignOut).toHaveBeenCalledWith({ reason: "account_deletion", redirect: true });
      expect(window.location.replace).toHaveBeenCalled();
      expect(mockSetOpen).toHaveBeenCalledWith(false);
    });
  });

  test("handles deletion errors", async () => {
    const deleteUserAction = vi.spyOn(actions, "deleteUserAction").mockRejectedValue(new Error("fail"));

    render(
      <DeleteAccountModal
        open={true}
        setOpen={mockSetOpen}
        user={mockUser}
        isFormbricksCloud={false}
        organizationsWithSingleOwner={[]}
      />
    );

    const input = screen.getByTestId("deleteAccountConfirmation");
    fireEvent.change(input, { target: { value: mockUser.email } });

    const form = screen.getByTestId("deleteAccountForm");
    fireEvent.submit(form);

    await waitFor(() => {
      expect(deleteUserAction).toHaveBeenCalled();
      expect(mockSetOpen).toHaveBeenCalledWith(false);
    });
  });
});
