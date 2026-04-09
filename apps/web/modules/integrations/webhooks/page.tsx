import { getSurveys } from "@/lib/survey/service";
import { getTranslate } from "@/lingodotdev/server";
import { AddWebhookButton } from "@/modules/integrations/webhooks/components/add-webhook-button";
import { WebhookRowData } from "@/modules/integrations/webhooks/components/webhook-row-data";
import { WebhookTable } from "@/modules/integrations/webhooks/components/webhook-table";
import { WebhookTableHeading } from "@/modules/integrations/webhooks/components/webhook-table-heading";
import { getWebhooks } from "@/modules/integrations/webhooks/lib/webhook";
import { GoBackButton } from "@/modules/ui/components/go-back-button";
import { PageContentWrapper } from "@/modules/ui/components/page-content-wrapper";
import { PageHeader } from "@/modules/ui/components/page-header";
import { getWorkspaceAuth } from "@/modules/workspaces/lib/utils";

export const WebhooksPage = async (props: { params: Promise<{ workspaceId: string }> }) => {
  const params = await props.params;
  const t = await getTranslate();

  const { isReadOnly, workspace } = await getWorkspaceAuth(params.workspaceId);

  const [webhooks, surveys] = await Promise.all([
    getWebhooks(workspace.id),
    getSurveys(workspace.id, 200), // HOTFIX: not getting all surveys for now since it's maxing out the prisma accelerate limit
  ]);

  const renderAddWebhookButton = () => <AddWebhookButton workspaceId={workspace.id} surveys={surveys} />;

  return (
    <PageContentWrapper>
      <GoBackButton />
      <PageHeader pageTitle={t("common.webhooks")} cta={!isReadOnly ? renderAddWebhookButton() : <></>} />
      <WebhookTable workspaceId={workspace.id} webhooks={webhooks} surveys={surveys} isReadOnly={isReadOnly}>
        <WebhookTableHeading />
        {webhooks.map((webhook) => (
          <WebhookRowData key={webhook.id} webhook={webhook} surveys={surveys} />
        ))}
      </WebhookTable>
    </PageContentWrapper>
  );
};
