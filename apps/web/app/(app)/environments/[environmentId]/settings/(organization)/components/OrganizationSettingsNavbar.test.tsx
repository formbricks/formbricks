import { getAccessFlags } from "@/lib/membership/utils";
import { cleanup, render, screen } from "@testing-library/react";
import { usePathname } from "next/navigation";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { TOrganizationRole } from "@formbricks/types/memberships";
import { OrganizationSettingsNavbar } from "./OrganizationSettingsNavbar";

vi.mock("next/navigation", () => ({
  usePathname: vi.fn(),
}));

vi.mock("@/lib/membership/utils", () => ({
  getAccessFlags: vi.fn(),
}));

// Mock SecondaryNavigation to inspect its props
let mockSecondaryNavigationProps: any;
vi.mock("@/modules/ui/components/secondary-navigation", () => ({
  SecondaryNavigation: (props: any) => {
    mockSecondaryNavigationProps = props;
    return <div data-testid="secondary-navigation">Mocked SecondaryNavigation</div>;
  },
}));

describe("OrganizationSettingsNavbar", () => {
  beforeEach(() => {
    mockSecondaryNavigationProps = null; // Reset before each test
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  const defaultProps = {
    environmentId: "env123",
    isFormbricksCloud: true,
    membershipRole: "owner" as TOrganizationRole,
    activeId: "general",
    loading: false,
  };

  test.each([
    {
      pathname: "/environments/env123/settings/general",
      role: "owner",
      isCloud: true,
      expectedVisibility: { general: true, billing: true, teams: true, enterprise: false, "api-keys": true },
    },
    {
      pathname: "/environments/env123/settings/teams",
      role: "member",
      isCloud: false,
      expectedVisibility: {
        general: true,
        billing: false,
        teams: true,
        enterprise: false,
        "api-keys": false,
      },
    }, // enterprise hidden if not cloud, api-keys hidden if not owner
    {
      pathname: "/environments/env123/settings/api-keys",
      role: "admin",
      isCloud: true,
      expectedVisibility: { general: true, billing: true, teams: true, enterprise: false, "api-keys": false },
    }, // api-keys hidden if not owner
    {
      pathname: "/environments/env123/settings/enterprise",
      role: "owner",
      isCloud: false,
      expectedVisibility: { general: true, billing: false, teams: true, enterprise: true, "api-keys": true },
    }, // enterprise shown if not cloud and not member
  ])(
    "renders correct navigation items based on props and path ($pathname, $role, $isCloud)",
    ({ pathname, role, isCloud, expectedVisibility }) => {
      vi.mocked(usePathname).mockReturnValue(pathname);
      vi.mocked(getAccessFlags).mockReturnValue({
        isOwner: role === "owner",
        isMember: role === "member",
      } as any);

      render(
        <OrganizationSettingsNavbar
          {...defaultProps}
          membershipRole={role as TOrganizationRole}
          isFormbricksCloud={isCloud}
        />
      );

      expect(screen.getByTestId("secondary-navigation")).toBeInTheDocument();
      expect(mockSecondaryNavigationProps).not.toBeNull();

      const visibleNavItems = mockSecondaryNavigationProps.navigation.filter((item: any) => !item.hidden);
      const visibleIds = visibleNavItems.map((item: any) => item.id);

      Object.entries(expectedVisibility).forEach(([id, shouldBeVisible]) => {
        if (shouldBeVisible) {
          expect(visibleIds).toContain(id);
        } else {
          expect(visibleIds).not.toContain(id);
        }
      });

      // Check current status
      mockSecondaryNavigationProps.navigation.forEach((item: any) => {
        if (item.href === pathname) {
          expect(item.current).toBe(true);
        }
      });
    }
  );

  test("passes loading prop to SecondaryNavigation", () => {
    vi.mocked(usePathname).mockReturnValue("/environments/env123/settings/general");
    vi.mocked(getAccessFlags).mockReturnValue({
      isOwner: true,
      isMember: false,
    } as any);
    render(<OrganizationSettingsNavbar {...defaultProps} loading={true} />);
    expect(mockSecondaryNavigationProps.loading).toBe(true);
  });

  test("hides billing when loading is true", () => {
    vi.mocked(usePathname).mockReturnValue("/environments/env123/settings/general");
    vi.mocked(getAccessFlags).mockReturnValue({
      isOwner: true,
      isMember: false,
    } as any);
    render(<OrganizationSettingsNavbar {...defaultProps} isFormbricksCloud={true} loading={true} />);
    const billingItem = mockSecondaryNavigationProps.navigation.find((item: any) => item.id === "billing");
    expect(billingItem.hidden).toBe(true);
  });
});
