import { getUser } from "@/lib/user/service";
import { cleanup, render, screen } from "@testing-library/react";
import { getServerSession } from "next-auth";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { prisma } from "@formbricks/database";
import { TUser } from "@formbricks/types/user";
import { EditAlerts } from "./components/EditAlerts";
import Page from "./page";
import { Membership } from "./types";

// Mock external dependencies
vi.mock(
  "@/app/(app)/environments/[environmentId]/settings/(account)/components/AccountSettingsNavbar",
  () => ({
    AccountSettingsNavbar: ({ activeId }) => <div>AccountSettingsNavbar activeId={activeId}</div>,
  })
);
vi.mock("@/app/(app)/environments/[environmentId]/settings/components/SettingsCard", () => ({
  SettingsCard: ({ title, description, children }) => (
    <div>
      <h1>{title}</h1>
      <p>{description}</p>
      {children}
    </div>
  ),
}));
vi.mock("@/lib/user/service", () => ({
  getUser: vi.fn(),
}));
vi.mock("@/modules/auth/lib/authOptions", () => ({
  authOptions: {},
}));
vi.mock("@/modules/ui/components/page-content-wrapper", () => ({
  PageContentWrapper: ({ children }) => <div>{children}</div>,
}));
vi.mock("@/modules/ui/components/page-header", () => ({
  PageHeader: ({ pageTitle, children }) => (
    <div>
      <h1>{pageTitle}</h1>
      {children}
    </div>
  ),
}));
vi.mock("@/tolgee/server", () => ({
  getTranslate: async () => (key: string) => key,
}));
vi.mock("next-auth", () => ({
  getServerSession: vi.fn(),
}));
vi.mock("@formbricks/database", () => ({
  prisma: {
    membership: {
      findMany: vi.fn(),
    },
  },
}));
vi.mock("./components/EditAlerts", () => ({
  EditAlerts: vi.fn(() => <div>EditAlertsComponent</div>),
}));

vi.mock("./components/IntegrationsTip", () => ({
  IntegrationsTip: () => <div>IntegrationsTipComponent</div>,
}));

const mockUser: Partial<TUser> = {
  id: "user-1",
  name: "Test User",
  email: "test@example.com",
  notificationSettings: {
    alert: { "survey-old": true },
    unsubscribedOrganizationIds: ["org-unsubscribed"],
  },
};

const mockMemberships: Membership[] = [
  {
    organization: {
      id: "org-1",
      name: "Org 1",
      projects: [
        {
          id: "project-1",
          name: "Project 1",
          environments: [
            {
              id: "env-prod-1",
              surveys: [
                { id: "survey-1", name: "Survey 1" },
                { id: "survey-2", name: "Survey 2" },
              ],
            },
          ],
        },
      ],
    },
  },
];

const mockSession = {
  user: {
    id: "user-1",
  },
} as any;

const mockParams = { environmentId: "env-1" };
const mockSearchParams = {
  type: "alertTest",
  elementId: "elementTestId",
};

describe("NotificationsPage", () => {
  afterEach(() => {
    cleanup();
    vi.resetAllMocks();
  });

  beforeEach(() => {
    vi.mocked(getServerSession).mockResolvedValue(mockSession);
    vi.mocked(getUser).mockResolvedValue(mockUser as TUser);
    vi.mocked(prisma.membership.findMany).mockResolvedValue(mockMemberships as any); // Prisma types can be complex
  });

  test("renders correctly with user and memberships, and processes notification settings", async () => {
    const props = { params: mockParams, searchParams: mockSearchParams };
    const PageComponent = await Page(props);
    render(PageComponent);

    expect(screen.getByText("common.account_settings")).toBeInTheDocument();
    expect(screen.getByText("AccountSettingsNavbar activeId=notifications")).toBeInTheDocument();
    expect(screen.getByText("environments.settings.notifications.email_alerts_surveys")).toBeInTheDocument();
    expect(
      screen.getByText("environments.settings.notifications.set_up_an_alert_to_get_an_email_on_new_responses")
    ).toBeInTheDocument();
    expect(screen.getByText("EditAlertsComponent")).toBeInTheDocument();
    expect(screen.getByText("IntegrationsTipComponent")).toBeInTheDocument();

    // The actual `user.notificationSettings` passed to EditAlerts will be a new object
    // after `setCompleteNotificationSettings` processes it.
    // We verify the structure and defaults.
    const editAlertsCall = vi.mocked(EditAlerts).mock.calls[0][0];
    expect(editAlertsCall.user.notificationSettings.alert["survey-1"]).toBe(false);
    expect(editAlertsCall.user.notificationSettings.alert["survey-2"]).toBe(false);
    // If "survey-old" was not part of any membership survey, it might be removed or kept depending on exact logic.
    // The current logic only adds keys from memberships. So "survey-old" would be gone from .alert
    // Let's adjust expectation based on `setCompleteNotificationSettings`
    // It iterates memberships, then projects, then environments, then surveys.
    // `newNotificationSettings.alert[survey.id] = notificationSettings[survey.id]?.responseFinished || (notificationSettings.alert && notificationSettings.alert[survey.id]) || false;`
    // This means only survey IDs found in memberships will be in the new `alert` object.

    const finalExpectedSettings = {
      alert: {
        "survey-1": false,
        "survey-2": false,
      },
      unsubscribedOrganizationIds: ["org-unsubscribed"],
    };

    expect(editAlertsCall.user.notificationSettings).toEqual(finalExpectedSettings);
    expect(editAlertsCall.memberships).toEqual(mockMemberships);
    expect(editAlertsCall.environmentId).toBe(mockParams.environmentId);
    expect(editAlertsCall.autoDisableNotificationType).toBe(mockSearchParams.type);
    expect(editAlertsCall.autoDisableNotificationElementId).toBe(mockSearchParams.elementId);
  });

  test("throws error if session is not found", async () => {
    vi.mocked(getServerSession).mockResolvedValue(null);
    const props = { params: mockParams, searchParams: {} };
    await expect(Page(props)).rejects.toThrow("common.session_not_found");
  });

  test("throws error if user is not found", async () => {
    vi.mocked(getUser).mockResolvedValue(null);
    const props = { params: mockParams, searchParams: {} };
    await expect(Page(props)).rejects.toThrow("common.user_not_found");
  });

  test("renders with empty memberships and default notification settings", async () => {
    vi.mocked(prisma.membership.findMany).mockResolvedValue([]);
    const userWithNoSpecificSettings = {
      ...mockUser,
      notificationSettings: { unsubscribedOrganizationIds: [] }, // Start fresh
    };
    vi.mocked(getUser).mockResolvedValue(userWithNoSpecificSettings as unknown as TUser);

    const props = { params: mockParams, searchParams: {} };
    const PageComponent = await Page(props);
    render(PageComponent);

    expect(screen.getByText("EditAlertsComponent")).toBeInTheDocument();

    const expectedEmptySettings = {
      alert: {},
      unsubscribedOrganizationIds: [],
    };

    const editAlertsCall = vi.mocked(EditAlerts).mock.calls[0][0];
    expect(editAlertsCall.user.notificationSettings).toEqual(expectedEmptySettings);
    expect(editAlertsCall.memberships).toEqual([]);
  });

  test("handles legacy notification settings correctly", async () => {
    const userWithLegacySettings: Partial<TUser> = {
      id: "user-legacy",
      notificationSettings: {
        "survey-1": { responseFinished: true }, // Legacy alert for survey-1
        unsubscribedOrganizationIds: [],
      } as any, // To allow legacy structure
    };
    vi.mocked(getUser).mockResolvedValue(userWithLegacySettings as TUser);
    // Memberships define survey-1 and project-1
    vi.mocked(prisma.membership.findMany).mockResolvedValue(mockMemberships as any);

    const props = { params: mockParams, searchParams: {} };
    const PageComponent = await Page(props);
    render(PageComponent);

    const expectedProcessedSettings = {
      alert: {
        "survey-1": true, // Should be true due to legacy setting
        "survey-2": false, // Default for other surveys in membership
      },
      unsubscribedOrganizationIds: [],
    };

    const editAlertsCall = vi.mocked(EditAlerts).mock.calls[0][0];
    expect(editAlertsCall.user.notificationSettings).toEqual(expectedProcessedSettings);
  });
});
