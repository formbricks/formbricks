import { WidgetStatusIndicator } from "@/app/(app)/environments/[environmentId]/components/WidgetStatusIndicator";
import { SettingsCard } from "@/app/(app)/environments/[environmentId]/settings/components/SettingsCard";
import { getPublicDomain } from "@/lib/getPublicUrl";
import { getEnvironmentAuth } from "@/modules/environments/lib/utils";
import { SetupInstructions } from "@/modules/projects/settings/(setup)/components/setup-instructions";
import { ProjectConfigNavigation } from "@/modules/projects/settings/components/project-config-navigation";
import { EnvironmentNotice } from "@/modules/ui/components/environment-notice";
import { IdBadge } from "@/modules/ui/components/id-badge";
import { PageContentWrapper } from "@/modules/ui/components/page-content-wrapper";
import { PageHeader } from "@/modules/ui/components/page-header";
import { getTranslate } from "@/tolgee/server";

export const AppConnectionPage = async (props) => {
  const params = await props.params;
  const t = await getTranslate();

  const { environment } = await getEnvironmentAuth(params.environmentId);

  const publicDomain = getPublicDomain();
  return (
    <PageContentWrapper>
      <PageHeader pageTitle={t("common.project_configuration")}>
        <ProjectConfigNavigation environmentId={params.environmentId} activeId="app-connection" />
      </PageHeader>
      <div className="space-y-4">
        <EnvironmentNotice environmentId={params.environmentId} subPageUrl="/project/app-connection" />
        <SettingsCard
          title={t("environments.project.app-connection.app_connection")}
          description={t("environments.project.app-connection.app_connection_description")}>
          {environment && <WidgetStatusIndicator environment={environment} />}
        </SettingsCard>
        <SettingsCard
          title={t("environments.project.app-connection.how_to_setup")}
          description={t("environments.project.app-connection.how_to_setup_description")}
          noPadding>
          <SetupInstructions environmentId={params.environmentId} publicDomain={publicDomain} />
        </SettingsCard>
        <SettingsCard
          title={t("environments.project.app-connection.environment_id")}
          description={t("environments.project.app-connection.environment_id_description")}>
          <IdBadge id={params.environmentId} />
        </SettingsCard>
      </div>
    </PageContentWrapper>
  );
};
