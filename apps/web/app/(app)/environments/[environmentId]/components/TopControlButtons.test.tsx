import { getAccessFlags } from "@/lib/membership/utils";
import { getTeamPermissionFlags } from "@/modules/ee/teams/utils/teams";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { TEnvironment } from "@formbricks/types/environment";
import { TOrganizationRole } from "@formbricks/types/memberships";
import { TopControlButtons } from "./TopControlButtons";

// Mock dependencies
const mockPush = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: vi.fn(() => ({ push: mockPush })),
}));

vi.mock("@/lib/membership/utils", () => ({
  getAccessFlags: vi.fn(),
}));

vi.mock("@/modules/ee/teams/utils/teams", () => ({
  getTeamPermissionFlags: vi.fn(),
}));

vi.mock("@/app/(app)/environments/[environmentId]/components/EnvironmentSwitch", () => ({
  EnvironmentSwitch: vi.fn(() => <div data-testid="environment-switch">EnvironmentSwitch</div>),
}));

vi.mock("@/modules/ui/components/button", () => ({
  Button: ({ children, onClick, variant, size, className, asChild, ...props }: any) => {
    const Tag = asChild ? "div" : "button"; // Use div if asChild is true for Link mock
    return (
      <Tag onClick={onClick} data-testid={`button-${className}`} {...props}>
        {children}
      </Tag>
    );
  },
}));

vi.mock("@/modules/ui/components/tooltip", () => ({
  TooltipRenderer: ({ children, tooltipContent }: { children: React.ReactNode; tooltipContent: string }) => (
    <div data-testid={`tooltip-${tooltipContent.split(".").pop()}`}>{children}</div>
  ),
}));

vi.mock("lucide-react", () => ({
  BugIcon: () => <div data-testid="bug-icon" />,
  CircleUserIcon: () => <div data-testid="circle-user-icon" />,
  PlusIcon: () => <div data-testid="plus-icon" />,
}));

vi.mock("next/link", () => ({
  default: ({ children, href, target }: { children: React.ReactNode; href: string; target?: string }) => (
    <a href={href} target={target} data-testid="link-mock">
      {children}
    </a>
  ),
}));

// Mock data
const mockEnvironmentDev: TEnvironment = {
  id: "dev-env-id",
  createdAt: new Date(),
  updatedAt: new Date(),
  type: "development",
  projectId: "project-id",
  appSetupCompleted: true,
};

const mockEnvironmentProd: TEnvironment = {
  id: "prod-env-id",
  createdAt: new Date(),
  updatedAt: new Date(),
  type: "production",
  projectId: "project-id",
  appSetupCompleted: true,
};

const mockEnvironments = [mockEnvironmentDev, mockEnvironmentProd];

describe("TopControlButtons", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default mocks for access flags
    vi.mocked(getAccessFlags).mockReturnValue({
      isOwner: false,
      isMember: false,
      isBilling: false,
    } as any);
    vi.mocked(getTeamPermissionFlags).mockReturnValue({
      hasReadAccess: false,
    } as any);
  });

  afterEach(() => {
    cleanup();
  });

  const renderComponent = (
    membershipRole?: TOrganizationRole,
    projectPermission: any = null,
    isBilling = false,
    hasReadAccess = false
  ) => {
    vi.mocked(getAccessFlags).mockReturnValue({
      isMember: membershipRole === "member",
      isBilling: isBilling,
      isOwner: membershipRole === "owner",
    } as any);
    vi.mocked(getTeamPermissionFlags).mockReturnValue({
      hasReadAccess: hasReadAccess,
    } as any);

    return render(
      <TopControlButtons
        environment={mockEnvironmentDev}
        environments={mockEnvironments}
        membershipRole={membershipRole}
        projectPermission={projectPermission}
      />
    );
  };

  test("renders correctly for Owner role", async () => {
    renderComponent("owner");

    expect(screen.getByTestId("environment-switch")).toBeInTheDocument();
    expect(screen.getByTestId("tooltip-share_feedback")).toBeInTheDocument();
    expect(screen.getByTestId("bug-icon")).toBeInTheDocument();
    expect(screen.getByTestId("tooltip-account")).toBeInTheDocument();
    expect(screen.getByTestId("circle-user-icon")).toBeInTheDocument();
    expect(screen.getByTestId("tooltip-new_survey")).toBeInTheDocument();
    expect(screen.getByTestId("plus-icon")).toBeInTheDocument();

    // Check link
    const link = screen.getByTestId("link-mock");
    expect(link).toHaveAttribute("href", "https://github.com/formbricks/formbricks/issues");
    expect(link).toHaveAttribute("target", "_blank");

    // Click account button
    const accountButton = screen.getByTestId("circle-user-icon").closest("button");
    await userEvent.click(accountButton!);
    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith(`/environments/${mockEnvironmentDev.id}/settings/profile`);
    });

    // Click new survey button
    const newSurveyButton = screen.getByTestId("plus-icon").closest("button");
    await userEvent.click(newSurveyButton!);
    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith(`/environments/${mockEnvironmentDev.id}/surveys/templates`);
    });
  });

  test("hides EnvironmentSwitch for Billing role", () => {
    renderComponent(undefined, null, true); // isBilling = true
    expect(screen.queryByTestId("environment-switch")).not.toBeInTheDocument();
    expect(screen.getByTestId("tooltip-share_feedback")).toBeInTheDocument();
    expect(screen.getByTestId("tooltip-account")).toBeInTheDocument();
    expect(screen.queryByTestId("tooltip-new_survey")).not.toBeInTheDocument(); // Hidden for billing
  });

  test("hides New Survey button for Billing role", () => {
    renderComponent(undefined, null, true); // isBilling = true
    expect(screen.queryByTestId("tooltip-new_survey")).not.toBeInTheDocument();
    expect(screen.queryByTestId("plus-icon")).not.toBeInTheDocument();
  });

  test("hides New Survey button for read-only Member", () => {
    renderComponent("member", null, false, true); // isMember = true, hasReadAccess = true
    expect(screen.getByTestId("environment-switch")).toBeInTheDocument();
    expect(screen.getByTestId("tooltip-share_feedback")).toBeInTheDocument();
    expect(screen.getByTestId("tooltip-account")).toBeInTheDocument();
    expect(screen.queryByTestId("tooltip-new_survey")).not.toBeInTheDocument();
    expect(screen.queryByTestId("plus-icon")).not.toBeInTheDocument();
  });

  test("shows New Survey button for Member with write access", () => {
    renderComponent("member", null, false, false); // isMember = true, hasReadAccess = false
    expect(screen.getByTestId("tooltip-new_survey")).toBeInTheDocument();
    expect(screen.getByTestId("plus-icon")).toBeInTheDocument();
  });
});
