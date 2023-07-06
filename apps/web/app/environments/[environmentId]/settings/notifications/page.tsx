import { authOptions } from "@/app/api/auth/[...nextauth]/authOptions";
import SettingsCard from "@/app/environments/[environmentId]/settings/SettingsCard";
import { prisma } from "@formbricks/database";
import { NotificationSettings } from "@formbricks/types/users";
import { getServerSession } from "next-auth";
import SettingsTitle from "../SettingsTitle";
import EditAlerts from "./EditAlerts";
import EditWeeklySummary from "./EditWeeklySummary";
import type { Membership, User } from "./types";

async function getUser(userId: string | undefined): Promise<User> {
  if (!userId) {
    throw new Error("Unauthorized");
  }
  const userData = await prisma.user.findUnique({
    where: {
      id: userId,
    },
    select: {
      id: true,
      notificationSettings: true,
    },
  });

  if (!userData) {
    throw new Error("Unauthorized");
  }

  const user = JSON.parse(JSON.stringify(userData)); // hack to remove the JsonValue type from the notificationSettings

  return user;
}

function cleanNotificationSettings(notificationSettings: NotificationSettings, memberships: Membership[]) {
  const newNotificationSettings = { alert: {}, weeklySummary: {} };
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

export default async function ProfileSettingsPage({ params }) {
  const session = await getServerSession(authOptions);
  if (!session) {
    throw new Error("Unauthorized");
  }
  const [user, memberships] = await Promise.all([getUser(session.user.id), getMemberships(session.user.id)]);
  user.notificationSettings = cleanNotificationSettings(user.notificationSettings, memberships);

  return (
    <div>
      <SettingsTitle title="Notifications" />
      <SettingsCard
        title="Email alerts (Surveys)"
        description="Set up an alert to get an email on new responses.">
        <EditAlerts memberships={memberships} user={user} environmentId={params.environmentId} />
      </SettingsCard>
      <SettingsCard
        title="Weekly summary (Products)"
        description="Stay up-to-date with a Weekly every Monday.">
        <EditWeeklySummary memberships={memberships} user={user} environmentId={params.environmentId} />
      </SettingsCard>
    </div>
  );
}
