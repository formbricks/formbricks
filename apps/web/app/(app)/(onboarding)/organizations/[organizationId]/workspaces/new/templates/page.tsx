import { redirect } from "next/navigation";
import { ResourceNotFoundError } from "@formbricks/types/errors";
import { ensureOnboardingWorkspace } from "@/app/(app)/(onboarding)/lib/ensure-onboarding-workspace";
import { redirectIfOnboardingComplete } from "@/app/(app)/(onboarding)/lib/redirect-if-onboarding-complete";
import { XMTemplateList } from "@/app/(app)/(onboarding)/organizations/[organizationId]/workspaces/new/templates/components/xm-template-list";
import { getUser } from "@/lib/user/service";
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

  const { workspace } = await ensureOnboardingWorkspace({
    userId: session.user.id,
    organizationId: params.organizationId,
  });

  await redirectIfOnboardingComplete(workspace.id);

  const user = await getUser(session.user.id);

  if (!user) {
    throw new ResourceNotFoundError(t("common.user"), session.user.id);
  }

  return (
    <div className="flex min-h-full min-w-full flex-col items-center justify-center gap-y-12">
      <Header title={t("workspace.xm-templates.headline")} />
      <XMTemplateList workspace={workspace} user={user} workspaceId={workspace.id} />
    </div>
  );
};

export default Page;
