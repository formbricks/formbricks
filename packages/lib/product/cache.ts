import { revalidateTag } from "next/cache";

interface RevalidateProps {
  id?: string;
  userId?: string;
  teamId?: string;
  environmentId?: string;
}

export const productCache = {
  tag: {
    byId(id: string) {
      return `product-${id}`;
    },
    byUserId(userId: string) {
      return `users-${userId}-products`;
    },
    byTeamId(teamId: string) {
      return `teams-${teamId}-products`;
    },
    byEnvironmentId(environmentId: string) {
      return `environments-${environmentId}-products`;
    },
  },
  revalidate({ id, userId, teamId, environmentId }: RevalidateProps): void {
    if (id) {
      revalidateTag(this.tag.byId(id));
    }

    if (teamId) {
      revalidateTag(this.tag.byTeamId(teamId));
    }

    if (environmentId) {
      revalidateTag(this.tag.byEnvironmentId(environmentId));
    }

    if (userId) {
      revalidateTag(this.tag.byUserId(userId));
    }
  },
};
