import WebhookRowData from "@/app/(app)/environments/[environmentId]/integrations/webhooks/components/WebhookRowData";
import WebhookTable from "@/app/(app)/environments/[environmentId]/integrations/webhooks/components/WebhookTable";
import WebhookTableHeading from "@/app/(app)/environments/[environmentId]/integrations/webhooks/components/WebhookTableHeading";
import { getEnvironment } from "@formbricks/lib/environment/service";
import { getSurveys } from "@formbricks/lib/survey/service";
import { getWebhooks } from "@formbricks/lib/webhook/service";
import GoBackButton from "@formbricks/ui/GoBackButton";

export default async function CustomWebhookPage({ params }) {
  const [webhooksUnsorted, surveys, environment] = await Promise.all([
    getWebhooks(params.environmentId),
    getSurveys(params.environmentId),
    getEnvironment(params.environmentId),
  ]);
  if (!environment) {
    throw new Error("Environment not found");
  }
  const webhooks = webhooksUnsorted.sort((a, b) => {
    if (a.createdAt > b.createdAt) return -1;
    if (a.createdAt < b.createdAt) return 1;
    return 0;
  });
  return (
    <>
      <GoBackButton />
      <WebhookTable environment={environment} webhooks={webhooks} surveys={surveys}>
        <WebhookTableHeading />
        {webhooks.map((webhook) => (
          <WebhookRowData key={webhook.id} webhook={webhook} surveys={surveys} />
        ))}
      </WebhookTable>
    </>
  );
}
