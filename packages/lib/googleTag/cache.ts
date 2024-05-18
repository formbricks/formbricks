import { revalidateTag } from "next/cache";

import { TGoogleTagInput } from "@formbricks/types/google-tags";

interface RevalidateProps {
  id?: string;
  environmentId?: string;
  gtmId: TGoogleTagInput["gtmId"];
}

export const googleTagCache = {
  tag: {
    byId(id: string) {
      return `tagsId-${id}`;
    },
    byEnvironmentId(environmentId: string) {
      return `environments-${environmentId}-gtmId`;
    },
    byEnvironmentIdAndGtmId(environmentId: string, tag: TGoogleTagInput["gtmId"]) {
      return `environments-${environmentId}-gtmId-${tag}`;
    },
    byEnvironmentIdAndSurveyId(environmentId: string, surveyId: string) {
      return `environments-${environmentId}-survey-${surveyId}`;
    },
  },
  revalidate({ id, environmentId, gtmId }: RevalidateProps): void {
    if (id) {
      revalidateTag(this.tag.byId(id));
    }

    if (environmentId) {
      revalidateTag(this.tag.byEnvironmentId(environmentId));
    }

    if (environmentId && gtmId) {
      revalidateTag(this.tag.byEnvironmentIdAndGtmId(environmentId, gtmId));
    }
  },
};
