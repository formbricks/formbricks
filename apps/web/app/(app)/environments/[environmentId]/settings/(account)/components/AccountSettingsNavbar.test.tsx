import { SecondaryNavigation } from "@/modules/ui/components/secondary-navigation";
import { cleanup, render } from "@testing-library/react";
import { usePathname } from "next/navigation";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { AccountSettingsNavbar } from "./AccountSettingsNavbar";

vi.mock("next/navigation", () => ({
  usePathname: vi.fn(),
}));

vi.mock("@/modules/ui/components/secondary-navigation", () => ({
  SecondaryNavigation: vi.fn(() => <div>SecondaryNavigationMock</div>),
}));

vi.mock("@tolgee/react", () => ({
  useTranslate: () => ({
    t: (key: string) => {
      if (key === "common.profile") return "Profile";
      if (key === "common.notifications") return "Notifications";
      return key;
    },
  }),
}));

describe("AccountSettingsNavbar", () => {
  afterEach(() => {
    cleanup();
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("renders correctly and sets profile as current when pathname includes /profile", () => {
    vi.mocked(usePathname).mockReturnValue("/environments/testEnvId/settings/profile");
    render(<AccountSettingsNavbar environmentId="testEnvId" activeId="profile" />);

    expect(SecondaryNavigation).toHaveBeenCalledWith(
      {
        navigation: [
          {
            id: "profile",
            label: "Profile",
            href: "/environments/testEnvId/settings/profile",
            current: true,
          },
          {
            id: "notifications",
            label: "Notifications",
            href: "/environments/testEnvId/settings/notifications",
            current: false,
          },
        ],
        activeId: "profile",
        loading: undefined,
      },
      undefined
    );
  });

  test("sets notifications as current when pathname includes /notifications", () => {
    vi.mocked(usePathname).mockReturnValue("/environments/testEnvId/settings/notifications");
    render(<AccountSettingsNavbar environmentId="testEnvId" activeId="notifications" />);

    expect(SecondaryNavigation).toHaveBeenCalledWith(
      expect.objectContaining({
        navigation: [
          {
            id: "profile",
            label: "Profile",
            href: "/environments/testEnvId/settings/profile",
            current: false,
          },
          {
            id: "notifications",
            label: "Notifications",
            href: "/environments/testEnvId/settings/notifications",
            current: true,
          },
        ],
        activeId: "notifications",
      }),
      undefined
    );
  });

  test("passes loading prop to SecondaryNavigation", () => {
    vi.mocked(usePathname).mockReturnValue("/environments/testEnvId/settings/profile");
    render(<AccountSettingsNavbar environmentId="testEnvId" activeId="profile" loading={true} />);

    expect(SecondaryNavigation).toHaveBeenCalledWith(
      expect.objectContaining({
        loading: true,
      }),
      undefined
    );
  });

  test("handles undefined environmentId gracefully in hrefs", () => {
    vi.mocked(usePathname).mockReturnValue("/environments/undefined/settings/profile");
    render(<AccountSettingsNavbar activeId="profile" />); // environmentId is undefined

    expect(SecondaryNavigation).toHaveBeenCalledWith(
      expect.objectContaining({
        navigation: [
          {
            id: "profile",
            label: "Profile",
            href: "/environments/undefined/settings/profile",
            current: true,
          },
          {
            id: "notifications",
            label: "Notifications",
            href: "/environments/undefined/settings/notifications",
            current: false,
          },
        ],
      }),
      undefined
    );
  });

  test("handles null pathname gracefully", () => {
    vi.mocked(usePathname).mockReturnValue("");
    render(<AccountSettingsNavbar environmentId="testEnvId" activeId="profile" />);

    expect(SecondaryNavigation).toHaveBeenCalledWith(
      expect.objectContaining({
        navigation: [
          {
            id: "profile",
            label: "Profile",
            href: "/environments/testEnvId/settings/profile",
            current: false,
          },
          {
            id: "notifications",
            label: "Notifications",
            href: "/environments/testEnvId/settings/notifications",
            current: false,
          },
        ],
      }),
      undefined
    );
  });
});
