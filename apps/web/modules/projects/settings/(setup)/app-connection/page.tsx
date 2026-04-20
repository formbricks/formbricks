"use server";

import Link from "next/link";
import { WidgetStatusIndicator } from "@/app/(app)/environments/[environmentId]/components/WidgetStatusIndicator";
import { SettingsCard } from "@/app/(app)/environments/[environmentId]/settings/components/SettingsCard";
import { getActionClasses } from "@/lib/actionClass/service";
import { DEFAULT_LOCALE, WEBAPP_URL } from "@/lib/constants";
import { getEnvironments } from "@/lib/environment/service";
import { getUserLocale } from "@/lib/user/service";
import { getTranslate } from "@/lingodotdev/server";
import { getEnvironmentAuth } from "@/modules/environments/lib/utils";
import { ProjectConfigNavigation } from "@/modules/projects/settings/components/project-config-navigation";
import { Alert, AlertButton, AlertDescription, AlertTitle } from "@/modules/ui/components/alert";
import { EnvironmentNotice } from "@/modules/ui/components/environment-notice";
import { IdBadge } from "@/modules/ui/components/id-badge";
import { PageContentWrapper } from "@/modules/ui/components/page-content-wrapper";
import { PageHeader } from "@/modules/ui/components/page-header";
import { ActionSettingsCard } from "../components/action-settings-card";

export const AppConnectionPage = async ({ params }: { params: Promise<{ environmentId: string }> }) => {
  const t = await getTranslate();
  const { environmentId } = await params;

  const { environment, isReadOnly, session } = await getEnvironmentAuth(environmentId);

  const [environments, actionClasses, locale] = await Promise.all([
    getEnvironments(environment.projectId),
    getActionClasses(environmentId),
    getUserLocale(session.user.id),
  ]);
  const otherEnvironment = environments.filter((env) => env.id !== environmentId)[0];
  const otherEnvActionClasses = otherEnvironment ? await getActionClasses(otherEnvironment.id) : [];

  return (
    <PageContentWrapper>
      <PageHeader pageTitle={t("common.workspace_configuration")}>
        <ProjectConfigNavigation environmentId={environmentId} activeId="app-connection" />
      </PageHeader>
      <div className="space-y-4">
        <EnvironmentNotice environmentId={environmentId} subPageUrl="/workspace/app-connection" />
        <SettingsCard
          title={t("environments.workspace.app-connection.sdk_connection_details")}
          description={t("environments.workspace.app-connection.sdk_connection_details_description")}>
          <div className="space-y-3">
            <IdBadge id={environmentId} label={t("environments.workspace.app-connection.environment_id")} />
            <IdBadge id={WEBAPP_URL} label={t("environments.workspace.app-connection.webapp_url")} />
          </div>
        </SettingsCard>
        <SettingsCard
          title={t("environments.workspace.app-connection.app_connection")}
          description={t("environments.workspace.app-connection.app_connection_description")}>
          {environment && (
            <div className="space-y-4">
              <WidgetStatusIndicator environment={environment} />
              {!environment.appSetupCompleted ? (
                <Alert variant="info">
                  <AlertTitle>{t("environments.workspace.app-connection.setup_alert_title")}</AlertTitle>
                  <AlertDescription>
                    {t("environments.workspace.app-connection.setup_alert_description")}
                  </AlertDescription>
                  <AlertButton asChild>
                    <Link
                      href="https://formbricks.com/docs/xm-and-surveys/surveys/website-app-surveys/framework-guides"
                      target="_blank"
                      rel="noopener noreferrer">
                      {t("common.learn_more")}
                    </Link>
                  </AlertButton>
                </Alert>
              ) : (
                <Alert variant="warning">
                  <AlertTitle>
                    {t("environments.workspace.app-connection.cache_update_delay_title")}
                  </AlertTitle>
                  <AlertDescription>
                    {t("environments.workspace.app-connection.cache_update_delay_description")}
                  </AlertDescription>
                </Alert>
              )}
            </div>
          )}
        </SettingsCard>
        <ActionSettingsCard
          environment={environment}
          otherEnvironment={otherEnvironment}
          otherEnvActionClasses={otherEnvActionClasses}
          environmentId={environmentId}
          actionClasses={actionClasses}
          isReadOnly={isReadOnly}
          locale={locale ?? DEFAULT_LOCALE}
        />
      </div>
    </PageContentWrapper>
  );
};
