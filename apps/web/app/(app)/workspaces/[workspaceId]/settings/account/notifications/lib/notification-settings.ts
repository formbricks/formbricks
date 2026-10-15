import "server-only";
import { prisma } from "@formbricks/database";
import type { TUserNotificationSettings } from "@formbricks/types/user";
import { buildVisibleSurveyWhereAcrossOrganizations } from "@/lib/survey/visibility/predicate";
import { getUser, updateUser } from "@/lib/user/service";
import type { Membership } from "../types";

/**
 * The notification settings read model, shared by the notifications page (server render + hydration) and
 * `/api/internal/users/me/notification-settings`, so both show the same thing.
 *
 * "Complete" settings carry a value for every survey the user may get alerts for: stored values, legacy
 * values from before the `alert` key existed, and `false` for the rest. A toggle is applied to the complete
 * settings and stored whole, exactly as the page used to submit them.
 */

export const completeNotificationSettings = (
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

export const getNotificationMemberships = async (userId: string): Promise<Membership[]> => {
  // ENG-3282: alerts are only offered for surveys whose responses this user may read.
  const visibleSurveyWhere = buildVisibleSurveyWhereAcrossOrganizations(true, userId);
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
                where: visibleSurveyWhere,
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

export type TNotificationToggle =
  | { type: "alert"; surveyId: string; enabled: boolean }
  | { type: "organizationEmails"; organizationId: string; subscribed: boolean };

/** One switch flipped. Pure: the caller stores the result. */
export const applyNotificationToggle = (
  settings: TUserNotificationSettings,
  toggle: TNotificationToggle
): TUserNotificationSettings => {
  if (toggle.type === "alert") {
    return { ...settings, alert: { ...settings.alert, [toggle.surveyId]: toggle.enabled } };
  }
  const unsubscribed = new Set(settings.unsubscribedOrganizationIds ?? []);
  if (toggle.subscribed) unsubscribed.delete(toggle.organizationId);
  else unsubscribed.add(toggle.organizationId);
  return { ...settings, unsubscribedOrganizationIds: [...unsubscribed] };
};

export type TNotificationSettingsView = {
  settings: TUserNotificationSettings;
  memberships: Membership[];
};

/** The user's complete settings and the organizations, workspaces and surveys they apply to. */
export const getNotificationSettingsView = async (
  userId: string
): Promise<TNotificationSettingsView | null> => {
  const [user, memberships] = await Promise.all([getUser(userId), getNotificationMemberships(userId)]);
  if (!user) return null;
  return { settings: completeNotificationSettings(user.notificationSettings, memberships), memberships };
};

/**
 * Flip one switch and store the result. Applied on the server to the stored settings, so two switches flipped
 * in quick succession can't overwrite each other the way whole-object writes from two stale copies could.
 */
export const updateNotificationSetting = async (
  userId: string,
  toggle: TNotificationToggle
): Promise<{ before: TUserNotificationSettings; after: TUserNotificationSettings } | null> => {
  const view = await getNotificationSettingsView(userId);
  if (!view) return null;
  const after = applyNotificationToggle(view.settings, toggle);
  await updateUser(userId, { notificationSettings: after });
  return { before: view.settings, after };
};
