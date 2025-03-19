import { SettingsCard } from "@/app/(app)/environments/[environmentId]/settings/components/SettingsCard";
import { getMultiLanguagePermission } from "@/modules/ee/license-check/lib/utils";
import { EditLanguage } from "@/modules/ee/multi-language-surveys/components/edit-language";
import { getEnvironmentAuth } from "@/modules/environments/lib/fetcher";
import { ProjectConfigNavigation } from "@/modules/projects/settings/components/project-config-navigation";
import { PageContentWrapper } from "@/modules/ui/components/page-content-wrapper";
import { PageHeader } from "@/modules/ui/components/page-header";
import { getTranslate } from "@/tolgee/server";
import { IS_FORMBRICKS_CLOUD } from "@formbricks/lib/constants";
import { getUser } from "@formbricks/lib/user/service";

export const LanguagesPage = async (props: { params: Promise<{ environmentId: string }> }) => {
  const params = await props.params;
  const t = await getTranslate();

  const { organization, session, project, isReadOnly } = await getEnvironmentAuth(params.environmentId);

  const isMultiLanguageAllowed = await getMultiLanguagePermission(organization.billing.plan);

  const user = await getUser(session.user.id);

  if (!user) {
    throw new Error("User not found");
  }

  return (
    <PageContentWrapper>
      <PageHeader pageTitle={t("common.project_configuration")}>
        <ProjectConfigNavigation environmentId={params.environmentId} activeId="languages" />
      </PageHeader>
      <SettingsCard
        title={t("environments.project.languages.multi_language_surveys")}
        description={t("environments.project.languages.multi_language_surveys_description")}>
        <EditLanguage
          project={project}
          locale={user.locale}
          isReadOnly={isReadOnly}
          isMultiLanguageAllowed={isMultiLanguageAllowed}
          environmentId={params.environmentId}
          isFormbricksCloud={IS_FORMBRICKS_CLOUD}
        />
      </SettingsCard>
    </PageContentWrapper>
  );
};
