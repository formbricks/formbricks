import { AccountSettingsNavbar } from "@/app/(app)/environments/[environmentId]/settings/(account)/components/AccountSettingsNavbar";
import { SettingsCard } from "@/app/(app)/environments/[environmentId]/settings/components/SettingsCard";
import { authOptions } from "@/modules/auth/lib/authOptions";
import { PageContentWrapper } from "@/modules/ui/components/page-content-wrapper";
import { PageHeader } from "@/modules/ui/components/page-header";
import { getServerSession } from "next-auth";
import { getTranslations } from "next-intl/server";
import { prisma } from "@formbricks/database";
import { getUser } from "@formbricks/lib/user/service";
import { TUserNotificationSettings } from "@formbricks/types/user";
import { EditAlerts } from "./components/EditAlerts";
import { EditWeeklySummary } from "./components/EditWeeklySummary";
import { IntegrationsTip } from "./components/IntegrationsTip";
import type { Membership } from "./types";

const setCompleteNotificationSettings = (
  notificationSettings: TUserNotificationSettings,
  memberships: Membership[]
): TUserNotificationSettings => {
  const newNotificationSettings = {
    alert: {},
    weeklySummary: {},
    unsubscribedOrganizationIds: notificationSettings.unsubscribedOrganizationIds || [],
  };
  for (const membership of memberships) {
    for (const product of membership.organization.products) {
      // set default values for weekly summary
      newNotificationSettings.weeklySummary[product.id] =
        (notificationSettings.weeklySummary && notificationSettings.weeklySummary[product.id]) || false;
      // set default values for alerts
      for (const environment of product.environments) {
        for (const survey of environment.surveys) {
          newNotificationSettings.alert[survey.id] =
            notificationSettings[survey.id]?.responseFinished ||
            (notificationSettings.alert && notificationSettings.alert[survey.id]) ||
            false; // check for legacy notification settings w/o "alerts" key
        }
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
          // Fetch all products if user role is owner or manager
          role: {
            in: ["owner", "manager"],
          },
        },
        {
          // Filter products based on team membership if user is not owner or manager
          organization: {
            products: {
              some: {
                productTeams: {
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
          products: {
            // Apply conditional filtering based on user's role
            where: {
              OR: [
                {
                  // Fetch all products if user is owner or manager
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
                  // Only include products accessible through teams if user is not owner or manager
                  productTeams: {
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
              environments: {
                where: {
                  type: "production",
                },
                select: {
                  id: true,
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
      },
    },
  });
  return memberships;
};

const Page = async (props) => {
  const searchParams = await props.searchParams;
  const params = await props.params;
  const t = await getTranslations();
  const session = await getServerSession(authOptions);
  if (!session) {
    throw new Error(t("common.session_not_found"));
  }
  const autoDisableNotificationType = searchParams["type"];
  const autoDisableNotificationElementId = searchParams["elementId"];

  const [user, memberships] = await Promise.all([getUser(session.user.id), getMemberships(session.user.id)]);
  if (!user) {
    throw new Error(t("common.user_not_found"));
  }

  if (user?.notificationSettings) {
    user.notificationSettings = setCompleteNotificationSettings(user.notificationSettings, memberships);
  }
  return (
    <PageContentWrapper>
      <PageHeader pageTitle={t("common.account_settings")}>
        <AccountSettingsNavbar environmentId={params.environmentId} activeId="notifications" />
      </PageHeader>
      <SettingsCard
        title={t("environments.settings.notifications.email_alerts_surveys")}
        description={t(
          "environments.settings.notifications.set_up_an_alert_to_get_an_email_on_new_responses"
        )}>
        <EditAlerts
          memberships={memberships}
          user={user}
          environmentId={params.environmentId}
          autoDisableNotificationType={autoDisableNotificationType}
          autoDisableNotificationElementId={autoDisableNotificationElementId}
        />
      </SettingsCard>
      <IntegrationsTip environmentId={params.environmentId} />
      <SettingsCard
        title={t("environments.settings.notifications.weekly_summary_products")}
        description={t("environments.settings.notifications.stay_up_to_date_with_a_Weekly_every_Monday")}>
        <EditWeeklySummary memberships={memberships} user={user} environmentId={params.environmentId} />
      </SettingsCard>
    </PageContentWrapper>
  );
};

export default Page;
