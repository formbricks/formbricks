import { revalidateTag } from "next/cache";

interface RevalidateProps {
  id?: string;
  projectId?: string;
}

export const environmentCache = {
  tag: {
    byId(id: string) {
      return `environments-${id}`;
    },
    byProjectId(projectId: string) {
      return `projects-${projectId}-environments`;
    },
  },
  revalidate({ id, projectId: projectId }: RevalidateProps): void {
    if (id) {
      revalidateTag(this.tag.byId(id));
    }

    if (projectId) {
      revalidateTag(this.tag.byProjectId(projectId));
    }
  },
};
