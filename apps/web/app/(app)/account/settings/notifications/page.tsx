import { HydrationBoundary, dehydrate } from "@tanstack/react-query";
import { AuthenticationError } from "@formbricks/types/errors";
import { EditAlerts } from "@/app/(app)/workspaces/[workspaceId]/settings/account/notifications/components/EditAlerts";
import { IntegrationsTip } from "@/app/(app)/workspaces/[workspaceId]/settings/account/notifications/components/IntegrationsTip";
import { getNotificationSettingsView } from "@/app/(app)/workspaces/[workspaceId]/settings/account/notifications/lib/notification-settings";
import { notificationSettingsKeys } from "@/app/(app)/workspaces/[workspaceId]/settings/account/notifications/lib/query";
import { SettingsCard } from "@/app/(app)/workspaces/[workspaceId]/settings/components/SettingsCard";
import { getTranslate } from "@/lingodotdev/server";
import { ApiQueryClientProvider } from "@/modules/api/components/api-query-client-provider";
import { makeQueryClient } from "@/modules/api/lib/query-client";
import { getSession } from "@/modules/auth/lib/session";
import { PageContentWrapper } from "@/modules/ui/components/page-content-wrapper";
import { PageHeader } from "@/modules/ui/components/page-header";

const Page = async (props: Readonly<{ searchParams: Promise<Record<string, string>> }>) => {
  const searchParams = await props.searchParams;
  const t = await getTranslate();
  const session = await getSession();
  if (!session) {
    throw new AuthenticationError(t("common.not_authenticated"));
  }
  const autoDisableNotificationType = searchParams["type"];
  const autoDisableNotificationElementId = searchParams["elementId"];

  // Read through the same function `/api/internal/users/me/notification-settings` answers with, and handed
  // to the client cache: the switches read and write through that route from here on.
  const view = await getNotificationSettingsView(session.user.id);
  if (!view) {
    throw new AuthenticationError(t("common.not_authenticated"));
  }
  const queryClient = makeQueryClient();
  queryClient.setQueryData(notificationSettingsKeys.mine(), view.settings);

  return (
    <PageContentWrapper>
      <PageHeader pageTitle={t("common.notifications")} />
      <SettingsCard
        title={t("workspace.settings.notifications.email_alerts_surveys")}
        description={t("workspace.settings.notifications.set_up_an_alert_to_get_an_email_on_new_responses")}>
        <ApiQueryClientProvider>
          <HydrationBoundary state={dehydrate(queryClient)}>
            <EditAlerts
              memberships={view.memberships}
              autoDisableNotificationType={autoDisableNotificationType}
              autoDisableNotificationElementId={autoDisableNotificationElementId}
            />
          </HydrationBoundary>
        </ApiQueryClientProvider>
      </SettingsCard>
      <IntegrationsTip />
    </PageContentWrapper>
  );
};

export default Page;
