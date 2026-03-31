import { SettingsCard } from "@/app/(app)/environments/[environmentId]/settings/components/SettingsCard";
import { getUser } from "@/lib/user/service";
import { getTranslate } from "@/lingodotdev/server";
import { getEnvironmentAuth } from "@/modules/environments/lib/utils";
import { EditLanguage } from "@/modules/survey/multi-language-surveys/components/edit-language";
import { PageContentWrapper } from "@/modules/ui/components/page-content-wrapper";
import { PageHeader } from "@/modules/ui/components/page-header";
import { WorkspaceConfigNavigation } from "@/modules/workspaces/settings/components/workspace-config-navigation";

export const LanguagesPage = async (props: { params: Promise<{ environmentId: string }> }) => {
  const params = await props.params;
  const t = await getTranslate();

  const { session, workspace, isReadOnly } = await getEnvironmentAuth(params.environmentId);

  const user = await getUser(session.user.id);

  if (!user) {
    throw new Error("User not found");
  }

  return (
    <PageContentWrapper>
      <PageHeader pageTitle={t("common.workspace_configuration")}>
        <WorkspaceConfigNavigation environmentId={params.environmentId} activeId="languages" />
      </PageHeader>
      <SettingsCard
        title={t("environments.workspace.languages.multi_language_surveys")}
        description={t("environments.workspace.languages.multi_language_surveys_description")}>
        <EditLanguage workspace={workspace} locale={user.locale} isReadOnly={isReadOnly} />
      </SettingsCard>
    </PageContentWrapper>
  );
};
