import { revalidateTag } from "next/cache";

interface RevalidateProps {
  id?: string;
  userId?: string;
  projectId?: string;
  organizationId?: string;
}

export const teamCache = {
  tag: {
    byId(id: string) {
      return `team-${id}`;
    },
    byProjectId(projectId: string) {
      return `project-teams-${projectId}`;
    },
    byUserId(userId: string) {
      return `user-${userId}-teams`;
    },
    byOrganizationId(organizationId: string) {
      return `organization-${organizationId}-teams`;
    },
  },
  revalidate: ({ id, projectId, userId, organizationId }: RevalidateProps): void => {
    if (id) {
      revalidateTag(teamCache.tag.byId(id));
    }
    if (projectId) {
      revalidateTag(teamCache.tag.byProjectId(projectId));
    }
    if (userId) {
      revalidateTag(teamCache.tag.byUserId(userId));
    }
    if (organizationId) {
      revalidateTag(teamCache.tag.byOrganizationId(organizationId));
    }
  },
};
