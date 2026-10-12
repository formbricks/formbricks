import { DANGEROUSLY_ALLOW_WEBHOOK_INTERNAL_URLS } from "@/lib/constants";
import { getTranslate } from "@/lingodotdev/server";
import { AddWebhookButton } from "@/modules/integrations/webhooks/components/add-webhook-button";
import { WebhookRowData } from "@/modules/integrations/webhooks/components/webhook-row-data";
import { WebhookTable } from "@/modules/integrations/webhooks/components/webhook-table";
import { WebhookTableHeading } from "@/modules/integrations/webhooks/components/webhook-table-heading";
import { getWebhookSurveys } from "@/modules/integrations/webhooks/lib/surveys";
import { getWebhooks } from "@/modules/integrations/webhooks/lib/webhook";
import { isSurveyVisibilityEnforced } from "@/modules/survey/visibility/lib/gate";
import { GoBackButton } from "@/modules/ui/components/go-back-button";
import { PageContentWrapper } from "@/modules/ui/components/page-content-wrapper";
import { PageHeader } from "@/modules/ui/components/page-header";
import { getWorkspaceAuth } from "@/modules/workspaces/lib/utils";

export const WebhooksPage = async (props: { params: Promise<{ workspaceId: string }> }) => {
  const params = await props.params;
  const t = await getTranslate();

  const { isReadOnly, organization, session, workspace } = await getWorkspaceAuth(params.workspaceId);

  const [webhooks, surveys, surveyVisibilityEnabled] = await Promise.all([
    getWebhooks(workspace.id),
    getWebhookSurveys(workspace.id, session.user.id, organization.id),
    isSurveyVisibilityEnforced(),
  ]);

  const renderAddWebhookButton = () => (
    <AddWebhookButton
      workspaceId={workspace.id}
      surveys={surveys}
      allowInternalUrls={DANGEROUSLY_ALLOW_WEBHOOK_INTERNAL_URLS}
      surveyVisibilityEnabled={surveyVisibilityEnabled}
    />
  );

  return (
    <PageContentWrapper>
      <GoBackButton />
      <PageHeader pageTitle={t("common.webhooks")} cta={!isReadOnly ? renderAddWebhookButton() : <></>} />
      <WebhookTable
        workspaceId={workspace.id}
        webhooks={webhooks}
        surveys={surveys}
        isReadOnly={isReadOnly}
        allowInternalUrls={DANGEROUSLY_ALLOW_WEBHOOK_INTERNAL_URLS}
        surveyVisibilityEnabled={surveyVisibilityEnabled}>
        <WebhookTableHeading />
        {webhooks.map((webhook) => (
          <WebhookRowData
            key={webhook.id}
            webhook={webhook}
            surveys={surveys}
            surveyVisibilityEnabled={surveyVisibilityEnabled}
          />
        ))}
      </WebhookTable>
    </PageContentWrapper>
  );
};
