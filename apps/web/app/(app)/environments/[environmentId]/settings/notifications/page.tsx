import SettingsCard from "@/app/(app)/environments/[environmentId]/settings/components/SettingsCard";
import { getServerSession } from "next-auth";

import { prisma } from "@formbricks/database";
import { authOptions } from "@formbricks/lib/authOptions";
import { getUser } from "@formbricks/lib/user/service";
import { TUserNotificationSettings } from "@formbricks/types/user";

import SettingsTitle from "../components/SettingsTitle";
import EditAlerts from "./components/EditAlerts";
import EditWeeklySummary from "./components/EditWeeklySummary";
import IntegrationsTip from "./components/IntegrationsTip";
import type { Membership } from "./types";

function setCompleteNotificationSettings(
  notificationSettings: TUserNotificationSettings,
  memberships: Membership[]
): TUserNotificationSettings {
  const newNotificationSettings = {
    alert: {},
    weeklySummary: {},
    doNotSubscribeToTeams: notificationSettings.doNotSubscribeToTeams || [],
  };
  for (const membership of memberships) {
    for (const product of membership.team.products) {
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
}

async function getMemberships(userId: string): Promise<Membership[]> {
  const memberships = await prisma.membership.findMany({
    where: {
      userId,
    },
    select: {
      team: {
        select: {
          id: true,
          name: true,
          products: {
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
}

export default async function ProfileSettingsPage({ params, searchParams }) {
  const session = await getServerSession(authOptions);
  if (!session) {
    throw new Error("Unauthorized");
  }
  const autoDisableNotificationType = searchParams["type"];
  const autoDisableNotificationElementId = searchParams["elementId"];

  const [user, memberships] = await Promise.all([getUser(session.user.id), getMemberships(session.user.id)]);
  if (!user) {
    throw new Error("User not found");
  }

  if (user?.notificationSettings) {
    user.notificationSettings = setCompleteNotificationSettings(user.notificationSettings, memberships);
  }

  return (
    <div>
      <SettingsTitle title="Notifications" />
      <SettingsCard
        title="Email alerts (Surveys)"
        description="Set up an alert to get an email on new responses.">
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
        beta
        title="Weekly summary (Products)"
        description="Stay up-to-date with a Weekly every Monday.">
        <EditWeeklySummary memberships={memberships} user={user} environmentId={params.environmentId} />
      </SettingsCard>
    </div>
  );
}
