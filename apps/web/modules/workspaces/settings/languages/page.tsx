import { AuthenticationError } from "@formbricks/types/errors";
import { SettingsCard } from "@/app/(app)/workspaces/[workspaceId]/settings/components/SettingsCard";
import { getUser } from "@/lib/user/service";
import { getTranslate } from "@/lingodotdev/server";
import { EditLanguage } from "@/modules/survey/multi-language-surveys/components/edit-language";
import { PageContentWrapper } from "@/modules/ui/components/page-content-wrapper";
import { PageHeader } from "@/modules/ui/components/page-header";
import { getWorkspaceAuth } from "@/modules/workspaces/lib/utils";
import { EditDefaultSurveyLanguageForm } from "@/modules/workspaces/settings/languages/components/edit-default-survey-language-form";

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
      <PageHeader pageTitle={t("common.survey_languages")} />
      <SettingsCard
        title={t("workspace.languages.multi_language_surveys")}
        description={t("workspace.languages.multi_language_surveys_description")}>
        <div className="flex flex-col gap-y-6">
          <EditLanguage workspace={workspace} locale={user.locale} isReadOnly={isReadOnly} />
          {/* Renders nothing until the workspace has a language to default to. */}
          <EditDefaultSurveyLanguageForm workspace={workspace} locale={user.locale} isReadOnly={isReadOnly} />
        </div>
      </SettingsCard>
    </PageContentWrapper>
  );
};
