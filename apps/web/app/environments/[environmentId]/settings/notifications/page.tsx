import SettingsCard from "@/app/environments/[environmentId]/settings/SettingsCard";
import SettingsTitle from "../SettingsTitle";
import EditAlerts from "./EditAlerts";
import { prisma } from "@formbricks/database";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/authOptions";
import type { Membership, User } from "./types";

async function getData(userId: string | undefined): Promise<{ memberships: Membership[]; user: User }> {
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
  return { user, memberships };
}

export default async function ProfileSettingsPage({ params }) {
  const session = await getServerSession(authOptions);
  if (!session) {
    throw new Error("Unauthorized");
  }
  const { user, memberships } = await getData(session.user.id);
  return (
    <div>
      <SettingsTitle title="Notifications" />
      <SettingsCard title="Email alerts" description="Set up an alert to get an email on new responses.">
        <EditAlerts memberships={memberships} user={user} environmentId={params.environmentId} />
      </SettingsCard>
    </div>
  );
}
