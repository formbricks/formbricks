"use server";

import { WidgetStatusIndicator } from "@/app/(app)/environments/[environmentId]/components/WidgetStatusIndicator";
import { SettingsCard } from "@/app/(app)/environments/[environmentId]/settings/components/SettingsCard";
import { getActionClasses } from "@/lib/actionClass/service";
import { getEnvironments } from "@/lib/environment/service";
import { findMatchingLocale } from "@/lib/utils/locale";
import { getEnvironmentAuth } from "@/modules/environments/lib/utils";
import { ProjectConfigNavigation } from "@/modules/projects/settings/components/project-config-navigation";
import { Alert, AlertButton, AlertDescription, AlertTitle } from "@/modules/ui/components/alert";
import { EnvironmentNotice } from "@/modules/ui/components/environment-notice";
import { IdBadge } from "@/modules/ui/components/id-badge";
import { PageContentWrapper } from "@/modules/ui/components/page-content-wrapper";
import { PageHeader } from "@/modules/ui/components/page-header";
import { getTranslate } from "@/tolgee/server";
import Link from "next/link";
import { ActionSettingsCard } from "../components/action-settings-card";

export const AppConnectionPage = async ({ params }: { params: { environmentId: string } }) => {
  const t = await getTranslate();

  const { environment, isReadOnly } = await getEnvironmentAuth(params.environmentId);

  const [environments, actionClasses] = await Promise.all([
    getEnvironments(environment.projectId),
    getActionClasses(params.environmentId),
  ]);
  const otherEnvironment = environments.filter((env) => env.id !== params.environmentId)[0];
  const [otherEnvActionClasses, locale] = await Promise.all([
    otherEnvironment ? getActionClasses(otherEnvironment.id) : Promise.resolve([]),
    findMatchingLocale(),
  ]);

  return (
    <PageContentWrapper>
      <PageHeader pageTitle={t("common.project_configuration")}>
        <ProjectConfigNavigation environmentId={params.environmentId} activeId="app-connection" />
      </PageHeader>
      <div className="space-y-4">
        <EnvironmentNotice environmentId={params.environmentId} subPageUrl="/project/app-connection" />
        <SettingsCard
          title={t("environments.project.app-connection.environment_id")}
          description={t("environments.project.app-connection.environment_id_description")}>
          <IdBadge id={params.environmentId} />
        </SettingsCard>
        <SettingsCard
          title={t("environments.project.app-connection.app_connection")}
          description={t("environments.project.app-connection.app_connection_description")}>
          {environment && (
            <div className="space-y-4">
              <WidgetStatusIndicator environment={environment} />
              <Alert variant="info">
                <AlertTitle>{t("environments.project.app-connection.setup_alert_title")}</AlertTitle>
                <AlertButton asChild>
                  <Link
                    href="https://formbricks.com/docs/xm-and-surveys/surveys/website-app-surveys/framework-guides"
                    target="_blank"
                    rel="noopener noreferrer">
                    {t("common.learn_more")}
                  </Link>
                </AlertButton>
              </Alert>
              <Alert variant="info">
                <AlertTitle>{t("environments.project.app-connection.cache_update_delay_title")}</AlertTitle>
                <AlertDescription>
                  {t("environments.project.app-connection.cache_update_delay_description")}
                </AlertDescription>
              </Alert>
            </div>
          )}
        </SettingsCard>
        <ActionSettingsCard
          environment={environment}
          otherEnvironment={otherEnvironment}
          otherEnvActionClasses={otherEnvActionClasses}
          environmentId={params.environmentId}
          actionClasses={actionClasses}
          isReadOnly={isReadOnly}
          locale={locale}
        />
      </div>
    </PageContentWrapper>
  );
};
