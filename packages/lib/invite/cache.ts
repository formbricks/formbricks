import { revalidateTag } from "next/cache";

interface RevalidateProps {
  id?: string;
  teamId?: string;
}

export const inviteCache = {
  tag: {
    byId(id: string) {
      return `invites-${id}`;
    },
    byTeamId(teamId: string) {
      return `teams-${teamId}-invites`;
    },
  },
  revalidate({ id, teamId }: RevalidateProps): void {
    if (id) {
      revalidateTag(this.tag.byId(id));
    }

    if (teamId) {
      revalidateTag(this.tag.byTeamId(teamId));
    }
  },
};
