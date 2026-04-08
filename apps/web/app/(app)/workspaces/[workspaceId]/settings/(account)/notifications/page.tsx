import { getServerSession } from "next-auth";
import { prisma } from "@formbricks/database";
import { AuthenticationError, ResourceNotFoundError } from "@formbricks/types/errors";
import { TUserNotificationSettings } from "@formbricks/types/user";
import { AccountSettingsNavbar } from "@/app/(app)/workspaces/[workspaceId]/settings/(account)/components/AccountSettingsNavbar";
import { EditAlerts } from "@/app/(app)/workspaces/[workspaceId]/settings/(account)/notifications/components/EditAlerts";
import { IntegrationsTip } from "@/app/(app)/workspaces/[workspaceId]/settings/(account)/notifications/components/IntegrationsTip";
import type { Membership } from "@/app/(app)/workspaces/[workspaceId]/settings/(account)/notifications/types";
import { SettingsCard } from "@/app/(app)/workspaces/[workspaceId]/settings/components/SettingsCard";
import { getUser } from "@/lib/user/service";
import { getTranslate } from "@/lingodotdev/server";
import { authOptions } from "@/modules/auth/lib/authOptions";
import { PageContentWrapper } from "@/modules/ui/components/page-content-wrapper";
import { PageHeader } from "@/modules/ui/components/page-header";

const setCompleteNotificationSettings = (
  notificationSettings: TUserNotificationSettings,
  memberships: Membership[]
): TUserNotificationSettings => {
  const newNotificationSettings: TUserNotificationSettings = {
    alert: {} as Record<string, boolean>,
    unsubscribedOrganizationIds: notificationSettings.unsubscribedOrganizationIds || [],
  };
  for (const membership of memberships) {
    for (const workspace of membership.organization.workspaces) {
      // set default values for alerts
      for (const survey of workspace.surveys) {
        newNotificationSettings.alert[survey.id] =
          (notificationSettings as unknown as Record<string, Record<string, boolean>>)[survey.id]
            ?.responseFinished ||
          (notificationSettings.alert && notificationSettings.alert[survey.id]) ||
          false; // check for legacy notification settings w/o "alerts" key
      }
    }
  }
  return newNotificationSettings;
};

const getMemberships = async (userId: string): Promise<Membership[]> => {
  const memberships = await prisma.membership.findMany({
    where: {
      userId,
      role: {
        not: "billing",
      },
      OR: [
        {
          // Fetch all workspaces if user role is owner or manager
          role: {
            in: ["owner", "manager"],
          },
        },
        {
          // Filter workspaces based on team membership if user is not owner or manager
          organization: {
            workspaces: {
              some: {
                workspaceTeams: {
                  some: {
                    team: {
                      teamUsers: {
                        some: {
                          userId,
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      ],
    },
    select: {
      organization: {
        select: {
          id: true,
          name: true,
          workspaces: {
            // Apply conditional filtering based on user's role
            where: {
              OR: [
                {
                  // Fetch all workspaces if user is owner or manager
                  organization: {
                    memberships: {
                      some: {
                        userId,
                        role: {
                          in: ["owner", "manager"],
                        },
                      },
                    },
                  },
                },
                {
                  // Only include workspaces accessible through teams if user is not owner or manager
                  workspaceTeams: {
                    some: {
                      team: {
                        teamUsers: {
                          some: {
                            userId,
                          },
                        },
                      },
                    },
                  },
                },
              ],
            },
            select: {
              id: true,
              name: true,
              surveys: {
                select: {
                  id: true,
                  name: true,
                },
              },
            },
          },
        },
      },
    },
  });
  return memberships;
};

const Page = async (props: {
  params: Promise<{ workspaceId: string }>;
  searchParams: Promise<Record<string, string>>;
}) => {
  const searchParams = await props.searchParams;
  const params = await props.params;
  const t = await getTranslate();
  const session = await getServerSession(authOptions);
  if (!session) {
    throw new AuthenticationError(t("common.not_authenticated"));
  }
  const autoDisableNotificationType = searchParams["type"];
  const autoDisableNotificationElementId = searchParams["elementId"];

  const [user, memberships] = await Promise.all([getUser(session.user.id), getMemberships(session.user.id)]);
  if (!user) {
    throw new AuthenticationError(t("common.not_authenticated"));
  }

  if (!memberships) {
    throw new ResourceNotFoundError(t("common.membership"), null);
  }

  if (user?.notificationSettings) {
    user.notificationSettings = setCompleteNotificationSettings(user.notificationSettings, memberships);
  }
  return (
    <PageContentWrapper>
      <PageHeader pageTitle={t("common.account_settings")}>
        <AccountSettingsNavbar environmentId={params.workspaceId} activeId="notifications" />
      </PageHeader>
      <SettingsCard
        title={t("workspace.settings.notifications.email_alerts_surveys")}
        description={t("workspace.settings.notifications.set_up_an_alert_to_get_an_email_on_new_responses")}>
        <EditAlerts
          memberships={memberships}
          user={user}
          autoDisableNotificationType={autoDisableNotificationType}
          autoDisableNotificationElementId={autoDisableNotificationElementId}
        />
      </SettingsCard>
      <IntegrationsTip />
    </PageContentWrapper>
  );
};

export default Page;
