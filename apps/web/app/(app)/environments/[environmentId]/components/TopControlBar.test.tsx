import { TopControlButtons } from "@/app/(app)/environments/[environmentId]/components/TopControlButtons";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vitest";
import { TEnvironment } from "@formbricks/types/environment";
import { TOrganizationRole } from "@formbricks/types/memberships";
import { TopControlBar } from "./TopControlBar";

// Mock the child component
vi.mock("@/app/(app)/environments/[environmentId]/components/TopControlButtons", () => ({
  TopControlButtons: vi.fn(() => <div data-testid="top-control-buttons">Mocked TopControlButtons</div>),
}));

const mockEnvironment: TEnvironment = {
  id: "env1",
  createdAt: new Date(),
  updatedAt: new Date(),
  type: "production",
  projectId: "proj1",
  appSetupCompleted: true,
};

const mockEnvironments: TEnvironment[] = [
  mockEnvironment,
  { ...mockEnvironment, id: "env2", type: "development" },
];

const mockMembershipRole: TOrganizationRole = "owner";
const mockProjectPermission = "manage";

describe("TopControlBar", () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  test("renders correctly and passes props to TopControlButtons", () => {
    render(
      <TopControlBar
        environment={mockEnvironment}
        environments={mockEnvironments}
        membershipRole={mockMembershipRole}
        projectPermission={mockProjectPermission}
      />
    );

    // Check if the main div is rendered
    const mainDiv = screen.getByTestId("fb__global-top-control-bar");
    expect(mainDiv).toHaveClass("flex h-14 w-full items-center justify-end bg-slate-50 px-6");

    // Check if the mocked child component is rendered
    expect(screen.getByTestId("top-control-buttons")).toBeInTheDocument();

    // Check if the child component received the correct props
    expect(TopControlButtons).toHaveBeenCalledWith(
      {
        environment: mockEnvironment,
        environments: mockEnvironments,
        membershipRole: mockMembershipRole,
        projectPermission: mockProjectPermission,
      },
      undefined // Updated from {} to undefined
    );
  });
});
