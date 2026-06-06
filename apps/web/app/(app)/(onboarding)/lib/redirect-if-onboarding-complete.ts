import "server-only";
import { redirect } from "next/navigation";
import { IS_FORMBRICKS_CLOUD } from "@/lib/constants";
import { getSurveyCount } from "@/lib/survey/service";
import { getOnboardingWorkspace } from "./onboarding-workspace";

export const redirectIfOnboardingComplete = async (workspaceId: string): Promise<void> => {
  const surveyCount = await getSurveyCount(workspaceId);

  if (surveyCount > 0) {
    redirect(`/workspaces/${workspaceId}/`);
  }
};

export const getOnboardingRedirectPath = async ({
  userId,
  organizationId,
}: {
  userId: string;
  organizationId: string;
}): Promise<string | null> => {
  const workspace = await getOnboardingWorkspace(userId, organizationId);

  if (!workspace) {
    return null;
  }

  const surveyCount = await getSurveyCount(workspace.id);

  if (surveyCount === 0) {
    if (IS_FORMBRICKS_CLOUD) {
      return `/organizations/${organizationId}/workspaces/new/plan`;
    }

    return `/organizations/${organizationId}/workspaces/new/survey`;
  }

  return null;
};
