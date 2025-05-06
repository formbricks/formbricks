import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import * as nextAuth from "next-auth/react";
import { afterEach, describe, expect, test, vi } from "vitest";
import { TOrganization } from "@formbricks/types/organizations";
import { TUser } from "@formbricks/types/user";
import * as actions from "./actions";
import { DeleteAccountModal } from "./index";

vi.mock("next-auth/react", async () => {
  const actual = await vi.importActual("next-auth/react");
  return {
    ...actual,
    signOut: vi.fn(),
  };
});

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
    const signOut = vi.spyOn(nextAuth, "signOut").mockResolvedValue(undefined);

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
      expect(signOut).toHaveBeenCalledWith({ callbackUrl: "/auth/login" });
      expect(mockSetOpen).toHaveBeenCalledWith(false);
    });
  });

  test("allows account deletion flow (cloud)", async () => {
    const deleteUserAction = vi
      .spyOn(actions, "deleteUserAction")
      .mockResolvedValue("deleted-user-id" as any); // the return doesn't matter here
    const signOut = vi.spyOn(nextAuth, "signOut").mockResolvedValue(undefined);

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
      expect(signOut).toHaveBeenCalledWith({ redirect: true });
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
