import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vitest";
import { TUser } from "@formbricks/types/user";
import { Membership } from "../types";
import { EditWeeklySummary } from "./EditWeeklySummary";

vi.mock("lucide-react", () => ({
  UsersIcon: () => <div data-testid="users-icon" />,
}));

vi.mock("next/link", () => ({
  default: ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href} data-testid="link">
      {children}
    </a>
  ),
}));

const mockNotificationSwitch = vi.fn();
vi.mock("./NotificationSwitch", () => ({
  NotificationSwitch: (props: any) => {
    mockNotificationSwitch(props);
    return (
      <div data-testid={`notification-switch-${props.surveyOrProjectOrOrganizationId}`}>
        NotificationSwitch
      </div>
    );
  },
}));

const mockT = vi.fn((key) => key);
vi.mock("@tolgee/react", () => ({
  useTranslate: () => ({
    t: mockT,
  }),
}));

const mockUser = {
  id: "user1",
  name: "Test User",
  email: "test@example.com",
  notificationSettings: {
    alert: {},
    weeklySummary: {
      proj1: true,
      proj3: false,
    },
    unsubscribedOrganizationIds: [],
  },
  role: "project_manager",
  objective: "other",
  emailVerified: new Date(),
  createdAt: new Date(),
  updatedAt: new Date(),
  identityProvider: "email",
  twoFactorEnabled: false,
} as unknown as TUser;

const mockMemberships: Membership[] = [
  {
    organization: {
      id: "org1",
      name: "Organization 1",
      projects: [
        { id: "proj1", name: "Project 1", environments: [] },
        { id: "proj2", name: "Project 2", environments: [] },
      ],
    },
  },
  {
    organization: {
      id: "org2",
      name: "Organization 2",
      projects: [{ id: "proj3", name: "Project 3", environments: [] }],
    },
  },
];

const environmentId = "test-env-id";

describe("EditWeeklySummary", () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  test("renders correctly with multiple memberships and projects", () => {
    render(<EditWeeklySummary memberships={mockMemberships} user={mockUser} environmentId={environmentId} />);

    expect(screen.getByText("Organization 1")).toBeInTheDocument();
    expect(screen.getByText("Project 1")).toBeInTheDocument();
    expect(screen.getByText("Project 2")).toBeInTheDocument();
    expect(screen.getByText("Organization 2")).toBeInTheDocument();
    expect(screen.getByText("Project 3")).toBeInTheDocument();

    expect(mockNotificationSwitch).toHaveBeenCalledWith(
      expect.objectContaining({
        surveyOrProjectOrOrganizationId: "proj1",
        notificationSettings: mockUser.notificationSettings,
        notificationType: "weeklySummary",
      })
    );
    expect(screen.getByTestId("notification-switch-proj1")).toBeInTheDocument();

    expect(mockNotificationSwitch).toHaveBeenCalledWith(
      expect.objectContaining({
        surveyOrProjectOrOrganizationId: "proj2",
        notificationSettings: mockUser.notificationSettings,
        notificationType: "weeklySummary",
      })
    );
    expect(screen.getByTestId("notification-switch-proj2")).toBeInTheDocument();

    expect(mockNotificationSwitch).toHaveBeenCalledWith(
      expect.objectContaining({
        surveyOrProjectOrOrganizationId: "proj3",
        notificationSettings: mockUser.notificationSettings,
        notificationType: "weeklySummary",
      })
    );
    expect(screen.getByTestId("notification-switch-proj3")).toBeInTheDocument();

    const inviteLinks = screen.getAllByTestId("link");
    expect(inviteLinks.length).toBe(mockMemberships.length);
    inviteLinks.forEach((link) => {
      expect(link).toHaveAttribute("href", `/environments/${environmentId}/settings/general`);
      expect(link).toHaveTextContent("common.invite_them");
    });

    expect(screen.getAllByTestId("users-icon").length).toBe(mockMemberships.length);

    expect(screen.getAllByText("common.project")[0]).toBeInTheDocument();
    expect(screen.getAllByText("common.weekly_summary")[0]).toBeInTheDocument();
    expect(
      screen.getAllByText("environments.settings.notifications.want_to_loop_in_organization_mates?").length
    ).toBe(mockMemberships.length);
  });

  test("renders correctly with no memberships", () => {
    render(<EditWeeklySummary memberships={[]} user={mockUser} environmentId={environmentId} />);
    expect(screen.queryByText("Organization 1")).not.toBeInTheDocument();
    expect(screen.queryByTestId("users-icon")).not.toBeInTheDocument();
  });

  test("renders correctly when an organization has no projects", () => {
    const membershipsWithNoProjects: Membership[] = [
      {
        organization: {
          id: "org3",
          name: "Organization No Projects",
          projects: [],
        },
      },
    ];
    render(
      <EditWeeklySummary
        memberships={membershipsWithNoProjects}
        user={mockUser}
        environmentId={environmentId}
      />
    );
    expect(screen.getByText("Organization No Projects")).toBeInTheDocument();
    expect(screen.queryByText("Project 1")).not.toBeInTheDocument(); // Check that no projects are listed under it
    expect(mockNotificationSwitch).not.toHaveBeenCalled(); // No projects, so no switches for projects
  });
});
