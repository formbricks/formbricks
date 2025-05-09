import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { signOut } from "next-auth/react";
import { afterEach, describe, expect, test, vi } from "vitest";
import { LandingSidebar } from "./landing-sidebar";

// Module mocks must be declared before importing the component
vi.mock("@tolgee/react", () => ({
  useTranslate: () => ({ t: (key: string) => key, isLoading: false }),
}));
vi.mock("next-auth/react", () => ({ signOut: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock("@/modules/organization/components/CreateOrganizationModal", () => ({
  CreateOrganizationModal: ({ open }: { open: boolean }) => (
    <div data-testid={open ? "modal-open" : "modal-closed"} />
  ),
}));
vi.mock("@/modules/ui/components/avatars", () => ({
  ProfileAvatar: ({ userId }: { userId: string }) => <div data-testid="avatar">{userId}</div>,
}));

// Ensure mocks are reset between tests
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("LandingSidebar component", () => {
  const user = { id: "u1", name: "Alice", email: "alice@example.com", imageUrl: "" } as any;
  const organization = { id: "o1", name: "orgOne" } as any;
  const organizations = [
    { id: "o2", name: "betaOrg" },
    { id: "o1", name: "alphaOrg" },
  ] as any;

  test("renders logo, avatar, and initial modal closed", () => {
    render(
      <LandingSidebar
        isMultiOrgEnabled={false}
        user={user}
        organization={organization}
        organizations={organizations}
      />
    );

    // Formbricks logo
    expect(screen.getByAltText("environments.formbricks_logo")).toBeInTheDocument();
    // Profile avatar
    expect(screen.getByTestId("avatar")).toHaveTextContent("u1");
    // CreateOrganizationModal should be closed initially
    expect(screen.getByTestId("modal-closed")).toBeInTheDocument();
  });

  test("clicking logout triggers signOut", async () => {
    render(
      <LandingSidebar
        isMultiOrgEnabled={false}
        user={user}
        organization={organization}
        organizations={organizations}
      />
    );

    // Open user dropdown by clicking on avatar trigger
    const trigger = screen.getByTestId("avatar").parentElement;
    if (trigger) await userEvent.click(trigger);

    // Click logout menu item
    const logoutItem = await screen.findByText("common.logout");
    await userEvent.click(logoutItem);

    expect(signOut).toHaveBeenCalledWith({ callbackUrl: "/auth/login" });
  });
});
