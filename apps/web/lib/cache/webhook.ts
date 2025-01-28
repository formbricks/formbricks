import { Webhook } from "@prisma/client";
import { revalidateTag } from "next/cache";

interface RevalidateProps {
  id?: string;
  environmentId?: string;
  source?: Webhook["source"];
}

export const webhookCache = {
  tag: {
    byId(id: string) {
      return `webhooks-${id}`;
    },
    byEnvironmentId(environmentId: string) {
      return `environments-${environmentId}-webhooks`;
    },
    byEnvironmentIdAndSource(environmentId: string, source?: Webhook["source"]) {
      return `environments-${environmentId}-sources-${source}-webhooks`;
    },
  },
  revalidate({ id, environmentId, source }: RevalidateProps): void {
    if (id) {
      revalidateTag(this.tag.byId(id));
    }

    if (environmentId) {
      revalidateTag(this.tag.byEnvironmentId(environmentId));
    }

    if (environmentId && source) {
      revalidateTag(this.tag.byEnvironmentIdAndSource(environmentId, source));
    }
  },
};
