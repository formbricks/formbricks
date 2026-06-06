import "server-only";
import { redirect } from "next/navigation";
import { getSurveyCount } from "@/lib/survey/service";
import { getOnboardingWorkspace } from "./ensure-onboarding-workspace";

export const redirectIfOnboardingComplete = async (workspaceId: string): Promise<void> => {
  const surveyCount = await getSurveyCount(workspaceId);

  if (surveyCount > 0) {
    redirect(`/workspaces/${workspaceId}/`);
  }
};

export const getOnboardingSurveyRedirectPath = async ({
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
    return `/organizations/${organizationId}/workspaces/new/survey`;
  }

  return null;
};
