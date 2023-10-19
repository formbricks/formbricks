import { revalidateTag } from "next/cache";

interface RevalidateProps {
  userId?: string;
  teamId?: string;
}

export const membershipCache = {
  tag: {
    byTeamId(teamId: string) {
      return `teams-${teamId}-memberships`;
    },
    byUserId(userId: string) {
      return `users-${userId}-memberships`;
    },
    byUserIdTeamId(userId: string, teamId: string) {
      return `users-${userId}-teams-${teamId}-memberships`;
    },
  },
  revalidate({ teamId, userId }: RevalidateProps): void {
    if (teamId) {
      revalidateTag(this.tag.byTeamId(teamId));
    }

    if (userId) {
      revalidateTag(this.tag.byUserId(userId));
    }

    if (userId && teamId) {
      revalidateTag(this.tag.byUserIdTeamId(userId, teamId));
    }
  },
};
