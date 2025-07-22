import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vitest";
import { TUser } from "@formbricks/types/user";
import { Membership } from "../types";
import { EditAlerts } from "./EditAlerts";

// Mock dependencies
vi.mock("@/modules/ui/components/tooltip", () => ({
  Tooltip: ({ children }: { children: React.ReactNode }) => <div data-testid="tooltip">{children}</div>,
  TooltipContent: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="tooltip-content">{children}</div>
  ),
  TooltipProvider: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="tooltip-provider">{children}</div>
  ),
  TooltipTrigger: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="tooltip-trigger">{children}</div>
  ),
}));

vi.mock("lucide-react", () => ({
  HelpCircleIcon: () => <div data-testid="help-circle-icon" />,
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

const mockUser = {
  id: "user1",
  name: "Test User",
  email: "test@example.com",
  notificationSettings: {
    alert: {},
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
        {
          id: "proj1",
          name: "Project 1",
          environments: [
            {
              id: "env1",
              surveys: [
                { id: "survey1", name: "Survey 1 Org 1 Proj 1" },
                { id: "survey2", name: "Survey 2 Org 1 Proj 1" },
              ],
            },
          ],
        },
        {
          id: "proj2",
          name: "Project 2",
          environments: [
            {
              id: "env2",
              surveys: [{ id: "survey3", name: "Survey 3 Org 1 Proj 2" }],
            },
          ],
        },
      ],
    },
  },
  {
    organization: {
      id: "org2",
      name: "Organization 2",
      projects: [
        {
          id: "proj3",
          name: "Project 3",
          environments: [
            {
              id: "env3",
              surveys: [{ id: "survey4", name: "Survey 4 Org 2 Proj 3" }],
            },
          ],
        },
      ],
    },
  },
  {
    organization: {
      id: "org3",
      name: "Organization 3 No Surveys",
      projects: [
        {
          id: "proj4",
          name: "Project 4",
          environments: [
            {
              id: "env4",
              surveys: [], // No surveys in this environment
            },
          ],
        },
      ],
    },
  },
];

const environmentId = "test-env-id";
const autoDisableNotificationType = "someType";
const autoDisableNotificationElementId = "someElementId";

describe("EditAlerts", () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  test("renders correctly with multiple memberships and surveys", () => {
    render(
      <EditAlerts
        memberships={mockMemberships}
        user={mockUser}
        environmentId={environmentId}
        autoDisableNotificationType={autoDisableNotificationType}
        autoDisableNotificationElementId={autoDisableNotificationElementId}
      />
    );

    // Check organization names
    expect(screen.getByText("Organization 1")).toBeInTheDocument();
    expect(screen.getByText("Organization 2")).toBeInTheDocument();
    expect(screen.getByText("Organization 3 No Surveys")).toBeInTheDocument();

    // Check survey names and project names as subtext
    expect(screen.getByText("Survey 1 Org 1 Proj 1")).toBeInTheDocument();
    expect(screen.getAllByText("Project 1")[0]).toBeInTheDocument(); // Project name under survey
    expect(screen.getByText("Survey 2 Org 1 Proj 1")).toBeInTheDocument();
    expect(screen.getByText("Survey 3 Org 1 Proj 2")).toBeInTheDocument();
    expect(screen.getAllByText("Project 2")[0]).toBeInTheDocument();
    expect(screen.getByText("Survey 4 Org 2 Proj 3")).toBeInTheDocument();
    expect(screen.getAllByText("Project 3")[0]).toBeInTheDocument();

    // Check "No surveys found" message for org3
    const org3Heading = screen.getByText("Organization 3 No Surveys");
    expect(org3Heading.parentElement?.parentElement?.parentElement).toHaveTextContent(
      "common.no_surveys_found"
    );

    // Check NotificationSwitch calls
    // Org 1 auto-subscribe
    expect(mockNotificationSwitch).toHaveBeenCalledWith(
      expect.objectContaining({
        surveyOrProjectOrOrganizationId: "org1",
        notificationType: "unsubscribedOrganizationIds",
        autoDisableNotificationType,
        autoDisableNotificationElementId,
      })
    );
    // Survey 1
    expect(mockNotificationSwitch).toHaveBeenCalledWith(
      expect.objectContaining({
        surveyOrProjectOrOrganizationId: "survey1",
        notificationType: "alert",
        autoDisableNotificationType,
        autoDisableNotificationElementId,
      })
    );
    // Survey 4
    expect(mockNotificationSwitch).toHaveBeenCalledWith(
      expect.objectContaining({
        surveyOrProjectOrOrganizationId: "survey4",
        notificationType: "alert",
        autoDisableNotificationType,
        autoDisableNotificationElementId,
      })
    );

    // Check tooltip
    expect(screen.getAllByTestId("tooltip-provider").length).toBeGreaterThan(0);
    expect(screen.getAllByTestId("tooltip").length).toBeGreaterThan(0);
    expect(screen.getAllByTestId("tooltip-trigger").length).toBeGreaterThan(0);
    expect(screen.getAllByTestId("tooltip-content")[0]).toHaveTextContent(
      "environments.settings.notifications.every_response_tooltip"
    );
    expect(screen.getAllByTestId("help-circle-icon").length).toBeGreaterThan(0);

    // Check invite link
    const inviteLinks = screen.getAllByTestId("link");
    const specificInviteLink = inviteLinks.find(
      (link) => link.getAttribute("href") === `/environments/${environmentId}/settings/general`
    );
    expect(specificInviteLink).toBeInTheDocument();
    expect(specificInviteLink).toHaveTextContent("common.invite_them");

    // Check UsersIcon
    expect(screen.getAllByTestId("users-icon").length).toBe(mockMemberships.length);
  });

  test("renders correctly when a membership has no surveys", () => {
    const singleMembershipNoSurveys: Membership[] = [
      {
        organization: {
          id: "org-no-survey",
          name: "Org Without Surveys",
          projects: [
            {
              id: "proj-no-survey",
              name: "Project Without Surveys",
              environments: [
                {
                  id: "env-no-survey",
                  surveys: [],
                },
              ],
            },
          ],
        },
      },
    ];
    render(
      <EditAlerts
        memberships={singleMembershipNoSurveys}
        user={mockUser}
        environmentId={environmentId}
        autoDisableNotificationType={autoDisableNotificationType}
        autoDisableNotificationElementId={autoDisableNotificationElementId}
      />
    );

    expect(screen.getByText("Org Without Surveys")).toBeInTheDocument();
    expect(screen.getByText("common.no_surveys_found")).toBeInTheDocument();
    expect(screen.queryByText("Survey 1 Org 1 Proj 1")).not.toBeInTheDocument(); // Ensure other surveys aren't rendered

    // Check NotificationSwitch for organization auto-subscribe
    expect(mockNotificationSwitch).toHaveBeenCalledWith(
      expect.objectContaining({
        surveyOrProjectOrOrganizationId: "org-no-survey",
        notificationType: "unsubscribedOrganizationIds",
      })
    );
  });
});
