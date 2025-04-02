import { getEnvironmentAuth } from "@/modules/environments/lib/utils";
import { AddWebhookButton } from "@/modules/integrations/webhooks/components/add-webhook-button";
import { WebhookRowData } from "@/modules/integrations/webhooks/components/webhook-row-data";
import { WebhookTable } from "@/modules/integrations/webhooks/components/webhook-table";
import { WebhookTableHeading } from "@/modules/integrations/webhooks/components/webhook-table-heading";
import { getWebhooks } from "@/modules/integrations/webhooks/lib/webhook";
import { GoBackButton } from "@/modules/ui/components/go-back-button";
import { PageContentWrapper } from "@/modules/ui/components/page-content-wrapper";
import { PageHeader } from "@/modules/ui/components/page-header";
import { getTranslate } from "@/tolgee/server";
import { getSurveys } from "@formbricks/lib/survey/service";

export const WebhooksPage = async (props) => {
  const params = await props.params;
  const t = await getTranslate();

  const { isReadOnly, environment } = await getEnvironmentAuth(params.environmentId);

  const [webhooks, surveys] = await Promise.all([
    getWebhooks(params.environmentId),
    getSurveys(params.environmentId, 200), // HOTFIX: not getting all surveys for now since it's maxing out the prisma accelerate limit
  ]);

  const renderAddWebhookButton = () => <AddWebhookButton environment={environment} surveys={surveys} />;

  return (
    <PageContentWrapper>
      <GoBackButton />
      <PageHeader pageTitle={t("common.webhooks")} cta={!isReadOnly ? renderAddWebhookButton() : <></>} />
      <WebhookTable environment={environment} webhooks={webhooks} surveys={surveys} isReadOnly={isReadOnly}>
        <WebhookTableHeading />
        {webhooks.map((webhook) => (
          <WebhookRowData key={webhook.id} webhook={webhook} surveys={surveys} />
        ))}
      </WebhookTable>
    </PageContentWrapper>
  );
};
