import { AuthenticationError } from "@formbricks/types/errors";
import { SettingsCard } from "@/app/(app)/workspaces/[workspaceId]/settings/components/SettingsCard";
import { getUser } from "@/lib/user/service";
import { getTranslate } from "@/lingodotdev/server";
import { EditLanguage } from "@/modules/survey/multi-language-surveys/components/edit-language";
import { PageContentWrapper } from "@/modules/ui/components/page-content-wrapper";
import { PageHeader } from "@/modules/ui/components/page-header";
import { getWorkspaceAuth } from "@/modules/workspaces/lib/utils";
import { WorkspaceConfigNavigation } from "@/modules/workspaces/settings/components/workspace-config-navigation";

export const LanguagesPage = async (props: { params: Promise<{ workspaceId: string }> }) => {
  const params = await props.params;
  const t = await getTranslate();

  const { session, workspace, isReadOnly } = await getWorkspaceAuth(params.workspaceId);

  const user = await getUser(session.user.id);

  if (!user) {
    throw new AuthenticationError(t("common.not_authenticated"));
  }

  return (
    <PageContentWrapper>
      <PageHeader pageTitle={t("common.workspace_configuration")}>
        <WorkspaceConfigNavigation activeId="languages" />
      </PageHeader>
      <SettingsCard
        title={t("workspace.languages.multi_language_surveys")}
        description={t("workspace.languages.multi_language_surveys_description")}>
        <EditLanguage workspace={workspace} locale={user.locale} isReadOnly={isReadOnly} />
      </SettingsCard>
    </PageContentWrapper>
  );
};
