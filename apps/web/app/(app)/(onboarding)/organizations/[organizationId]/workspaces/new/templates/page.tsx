import { redirect } from "next/navigation";
import { getOnboardingWorkspaceContext } from "@/app/(app)/(onboarding)/lib/onboarding-workspace";
import { redirectIfOnboardingComplete } from "@/app/(app)/(onboarding)/lib/redirect-if-onboarding-complete";
import { XMTemplateList } from "@/app/(app)/(onboarding)/organizations/[organizationId]/workspaces/new/templates/components/xm-template-list";
import { DEFAULT_LOCALE } from "@/lib/constants";
import { getUserLocale } from "@/lib/user/service";
import { getTranslate } from "@/lingodotdev/server";
import { getOrganizationAuth } from "@/modules/organization/lib/utils";
import { TemplateCreateQueryClientProvider } from "@/modules/survey/components/template-list/query-client-provider";
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

  const locale = (await getUserLocale(session.user.id)) ?? DEFAULT_LOCALE;

  return (
    <div className="flex min-h-full min-w-full flex-col items-center justify-center gap-y-12">
      <Header title={t("workspace.xm-templates.headline")} />
      <TemplateCreateQueryClientProvider>
        <XMTemplateList workspaceId={workspace.id} defaultLanguage={locale} />
      </TemplateCreateQueryClientProvider>
    </div>
  );
};

export default Page;
