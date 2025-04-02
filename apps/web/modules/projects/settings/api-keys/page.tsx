import { SettingsCard } from "@/app/(app)/environments/[environmentId]/settings/components/SettingsCard";
import { getEnvironmentAuth } from "@/modules/environments/lib/utils";
import { ProjectConfigNavigation } from "@/modules/projects/settings/components/project-config-navigation";
import { EnvironmentNotice } from "@/modules/ui/components/environment-notice";
import { PageContentWrapper } from "@/modules/ui/components/page-content-wrapper";
import { PageHeader } from "@/modules/ui/components/page-header";
import { getTranslate } from "@/tolgee/server";
import { ApiKeyList } from "./components/api-key-list";

export const APIKeysPage = async (props) => {
  const params = await props.params;
  const t = await getTranslate();

  // Use the new utility to get all required data with authorization checks
  const { environment, isReadOnly } = await getEnvironmentAuth(params.environmentId);

  return (
    <PageContentWrapper>
      <PageHeader pageTitle={t("common.project_configuration")}>
        <ProjectConfigNavigation environmentId={params.environmentId} activeId="api-keys" />
      </PageHeader>
      <EnvironmentNotice environmentId={environment.id} subPageUrl="/project/api-keys" />
      {environment.type === "development" ? (
        <SettingsCard
          title={t("environments.project.api-keys.dev_api_keys")}
          description={t("environments.project.api-keys.dev_api_keys_description")}>
          <ApiKeyList
            environmentId={params.environmentId}
            environmentType="development"
            isReadOnly={isReadOnly}
          />
        </SettingsCard>
      ) : (
        <SettingsCard
          title={t("environments.project.api-keys.prod_api_keys")}
          description={t("environments.project.api-keys.prod_api_keys_description")}>
          <ApiKeyList
            environmentId={params.environmentId}
            environmentType="production"
            isReadOnly={isReadOnly}
          />
        </SettingsCard>
      )}
    </PageContentWrapper>
  );
};
