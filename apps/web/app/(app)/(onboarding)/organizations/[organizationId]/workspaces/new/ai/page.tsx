import { redirect } from "next/navigation";
import { getOnboardingWorkspaceContext } from "@/app/(app)/(onboarding)/lib/onboarding-workspace";
import { redirectIfOnboardingComplete } from "@/app/(app)/(onboarding)/lib/redirect-if-onboarding-complete";
import { CreateSurveyWithAIOnboarding } from "@/app/(app)/(onboarding)/organizations/[organizationId]/workspaces/new/ai/components/create-survey-with-ai-onboarding";
import { DEFAULT_LOCALE } from "@/lib/constants";
import { getUserLocale } from "@/lib/user/service";
import { getOrganizationAuth } from "@/modules/organization/lib/utils";
import { getSurveyAIAvailability } from "@/modules/survey/lib/get-survey-ai-availability";

interface AIOnboardingPageProps {
  params: Promise<{
    organizationId: string;
  }>;
}

const Page = async (props: AIOnboardingPageProps) => {
  const params = await props.params;

  const { session } = await getOrganizationAuth(params.organizationId);

  if (!session?.user) {
    return redirect(`/auth/login`);
  }

  const { workspace, isAISmartToolsEnabled, isAISmartToolsEntitled } = await getOnboardingWorkspaceContext({
    userId: session.user.id,
    organizationId: params.organizationId,
  });

  await redirectIfOnboardingComplete(workspace.id);

  const { isAIAvailable } = await getSurveyAIAvailability(params.organizationId, {
    isAISmartToolsEnabled,
    isAISmartToolsEntitled,
  });

  if (!isAIAvailable) {
    return redirect(`/organizations/${params.organizationId}/workspaces/new/survey`);
  }

  const locale = (await getUserLocale(session.user.id)) ?? DEFAULT_LOCALE;

  return (
    <div className="flex min-h-full min-w-full flex-col items-center justify-center">
      <CreateSurveyWithAIOnboarding workspaceId={workspace.id} language={locale} />
    </div>
  );
};

export default Page;
