"use server";

import Link from "next/link";
import { WidgetStatusIndicator } from "@/app/(app)/environments/[environmentId]/components/WidgetStatusIndicator";
import { SettingsCard } from "@/app/(app)/environments/[environmentId]/settings/components/SettingsCard";
import { WEBAPP_URL } from "@/lib/constants";
import { getTranslate } from "@/lingodotdev/server";
import { getEnvironmentAuth } from "@/modules/environments/lib/utils";
import { Alert, AlertButton, AlertDescription, AlertTitle } from "@/modules/ui/components/alert";
import { EnvironmentNotice } from "@/modules/ui/components/environment-notice";
import { IdBadge } from "@/modules/ui/components/id-badge";
import { PageContentWrapper } from "@/modules/ui/components/page-content-wrapper";
import { PageHeader } from "@/modules/ui/components/page-header";

export const AppConnectionPage = async ({ params }: { params: Promise<{ environmentId: string }> }) => {
  const t = await getTranslate();
  const { environmentId } = await params;

  const { environment } = await getEnvironmentAuth(environmentId);

  return (
    <PageContentWrapper>
      <PageHeader pageTitle={t("common.website_and_app_connection")} />
      <div className="space-y-4">
        <EnvironmentNotice environmentId={environmentId} subPageUrl="/settings/workspace/connect" />
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
      </div>
    </PageContentWrapper>
  );
};
