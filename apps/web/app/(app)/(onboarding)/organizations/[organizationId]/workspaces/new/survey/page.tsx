import { redirect } from "next/navigation";
import { ensureOnboardingWorkspace } from "@/app/(app)/(onboarding)/lib/ensure-onboarding-workspace";
import { redirectIfOnboardingComplete } from "@/app/(app)/(onboarding)/lib/redirect-if-onboarding-complete";
import { CreateFirstSurvey } from "@/app/(app)/(onboarding)/organizations/[organizationId]/workspaces/new/survey/components/create-first-survey";
import { getTranslate } from "@/lingodotdev/server";
import { getOrganizationAuth } from "@/modules/organization/lib/utils";
import { getSurveyAIAvailability } from "@/modules/survey/lib/get-survey-ai-availability";
import { Header } from "@/modules/ui/components/header";

interface SurveyOnboardingPageProps {
  params: Promise<{
    organizationId: string;
  }>;
}

const Page = async (props: SurveyOnboardingPageProps) => {
  const params = await props.params;
  const t = await getTranslate();

  const { session } = await getOrganizationAuth(params.organizationId);

  if (!session?.user) {
    return redirect(`/auth/login`);
  }

  const { workspace, isAISmartToolsEnabled, isAISmartToolsEntitled } = await ensureOnboardingWorkspace({
    userId: session.user.id,
    organizationId: params.organizationId,
  });

  await redirectIfOnboardingComplete(workspace.id);

  const { isAIAvailable, aiUnavailableReason } = await getSurveyAIAvailability(params.organizationId, {
    isAISmartToolsEnabled,
    isAISmartToolsEntitled,
  });

  return (
    <div className="flex min-h-full min-w-full flex-col items-center justify-center gap-y-12">
      <Header title={t("organizations.workspaces.new.survey.title")} />
      <CreateFirstSurvey
        organizationId={params.organizationId}
        workspaceId={workspace.id}
        userId={session.user.id}
        isAIAvailable={isAIAvailable}
        aiUnavailableReason={aiUnavailableReason}
      />
    </div>
  );
};

export default Page;
