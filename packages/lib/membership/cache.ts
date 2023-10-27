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
  },
  revalidate({ teamId, userId }: RevalidateProps): void {
    if (teamId) {
      revalidateTag(this.tag.byTeamId(teamId));
    }

    if (userId) {
      revalidateTag(this.tag.byUserId(userId));
    }
  },
};
