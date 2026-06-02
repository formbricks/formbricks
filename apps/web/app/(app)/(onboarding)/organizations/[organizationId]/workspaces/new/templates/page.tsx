import { redirect } from "next/navigation";
import { getOnboardingWorkspaceContext } from "@/app/(app)/(onboarding)/lib/onboarding-workspace";
import { redirectIfOnboardingComplete } from "@/app/(app)/(onboarding)/lib/redirect-if-onboarding-complete";
import { XMTemplateList } from "@/app/(app)/(onboarding)/organizations/[organizationId]/workspaces/new/templates/components/xm-template-list";
import { getTranslate } from "@/lingodotdev/server";
import { getOrganizationAuth } from "@/modules/organization/lib/utils";
import { Header } from "@/modules/ui/components/header";

interface TemplatesOnboardingPageProps {
  params: Promise<{
    organizationId: string;
  }>;
}

const Page = async (props: TemplatesOnboardingPageProps) => {
  const params = await props.params;
  const t = await getTranslate();

  const { session } = await getOrganizationAuth(params.organizationId);

  if (!session?.user) {
    return redirect(`/auth/login`);
  }

  const { workspace } = await getOnboardingWorkspaceContext({
    userId: session.user.id,
    organizationId: params.organizationId,
  });

  await redirectIfOnboardingComplete(workspace.id);

  return (
    <div className="flex min-h-full min-w-full flex-col items-center justify-center gap-y-12">
      <Header title={t("workspace.xm-templates.headline")} />
      <XMTemplateList workspaceId={workspace.id} />
    </div>
  );
};

export default Page;
