"use server";

import Link from "next/link";
import { WidgetStatusIndicator } from "@/app/(app)/workspaces/[workspaceId]/components/WidgetStatusIndicator";
import { SettingsCard } from "@/app/(app)/workspaces/[workspaceId]/settings/components/SettingsCard";
import { getActionClasses } from "@/lib/actionClass/service";
import { DEFAULT_LOCALE, WEBAPP_URL } from "@/lib/constants";
import { getUserLocale } from "@/lib/user/service";
import { getTranslate } from "@/lingodotdev/server";
import { Alert, AlertButton, AlertDescription, AlertTitle } from "@/modules/ui/components/alert";
import { IdBadge } from "@/modules/ui/components/id-badge";
import { PageContentWrapper } from "@/modules/ui/components/page-content-wrapper";
import { PageHeader } from "@/modules/ui/components/page-header";
import { getWorkspaceAuth } from "@/modules/workspaces/lib/utils";
import { WorkspaceConfigNavigation } from "@/modules/workspaces/settings/components/workspace-config-navigation";
import { ActionSettingsCard } from "../components/action-settings-card";

export const AppConnectionPage = async ({ params }: { params: Promise<{ workspaceId: string }> }) => {
  const t = await getTranslate();
  const { workspaceId } = await params;

  const { environment, isReadOnly, session, workspace } = await getWorkspaceAuth(workspaceId);

  const [actionClasses, locale] = await Promise.all([
    getActionClasses(workspace.id),
    getUserLocale(session.user.id),
  ]);

  return (
    <PageContentWrapper>
      <PageHeader pageTitle={t("common.workspace_configuration")}>
        <WorkspaceConfigNavigation activeId="app-connection" />
      </PageHeader>
      <div className="space-y-4">
        <SettingsCard
          title={t("workspace.app-connection.sdk_connection_details")}
          description={t("workspace.app-connection.sdk_connection_details_description")}>
          <div className="space-y-3">
            <IdBadge id={workspace.id} label={t("workspace.app-connection.environment_id")} />
            <IdBadge id={WEBAPP_URL} label={t("workspace.app-connection.webapp_url")} />
          </div>
        </SettingsCard>
        <SettingsCard
          title={t("workspace.app-connection.app_connection")}
          description={t("workspace.app-connection.app_connection_description")}>
          {environment && (
            <div className="space-y-4">
              <WidgetStatusIndicator environment={environment} />
              {!environment.appSetupCompleted ? (
                <Alert variant="info">
                  <AlertTitle>{t("workspace.app-connection.setup_alert_title")}</AlertTitle>
                  <AlertDescription>{t("workspace.app-connection.setup_alert_description")}</AlertDescription>
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
                  <AlertTitle>{t("workspace.app-connection.cache_update_delay_title")}</AlertTitle>
                  <AlertDescription>
                    {t("workspace.app-connection.cache_update_delay_description")}
                  </AlertDescription>
                </Alert>
              )}
            </div>
          )}
        </SettingsCard>
        <ActionSettingsCard
          environment={environment}
          otherEnvironment={environment}
          otherEnvActionClasses={[]}
          environmentId={environment.id}
          workspaceId={workspace.id}
          actionClasses={actionClasses}
          isReadOnly={isReadOnly}
          locale={locale ?? DEFAULT_LOCALE}
        />
      </div>
    </PageContentWrapper>
  );
};
