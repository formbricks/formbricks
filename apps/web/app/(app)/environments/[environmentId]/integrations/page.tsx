import JsLogo from "@/images/jslogo.png";
import WebhookLogo from "@/images/webhook.png";
import ZapierLogo from "@/images/zapier-small.png";
import GoogleSheetsLogo from "@/images/google-sheets-small.png";
import n8nLogo from "@/images/n8n.png";
import MakeLogo from "@/images/make-small.png";
import { Card } from "@formbricks/ui";
import Image from "next/image";
import { getCountOfWebhooksBasedOnSource } from "@formbricks/lib/webhook/service";
import { getEnvironment } from "@formbricks/lib/environment/service";
import { getIntegrations } from "@formbricks/lib/integration/service";

export default async function IntegrationsPage({ params }) {
  const environmentId = params.environmentId;

  const [environment, integrations, userWebhooks, zapierWebhooks] = await Promise.all([
    getEnvironment(environmentId),
    getIntegrations(environmentId),
    getCountOfWebhooksBasedOnSource(environmentId, "user"),
    getCountOfWebhooksBasedOnSource(environmentId, "zapier"),
  ]);

  const containsGoogleSheetIntegration = integrations.some(
    (integration) => integration.type === "googleSheets"
  );

  const integrationCards = [
    {
      docsHref: "https://formbricks.com/docs/getting-started/framework-guides#next-js",
      docsText: "Docs",
      docsNewTab: true,
      label: "Javascript Widget",
      description: "Integrate Formbricks into your Webapp",
      icon: <Image src={JsLogo} alt="Javascript Logo" />,
      connected: environment?.widgetSetupCompleted,
      statusText: environment?.widgetSetupCompleted ? "Connected" : "Not Connected",
    },
    {
      docsHref: "https://formbricks.com/docs/integrations/zapier",
      docsText: "Docs",
      docsNewTab: true,
      connectHref: "https://zapier.com/apps/formbricks/integrations",
      connectText: "Connect",
      connectNewTab: true,
      label: "Zapier",
      description: "Integrate Formbricks with 5000+ apps via Zapier",
      icon: <Image src={ZapierLogo} alt="Zapier Logo" />,
      connected: zapierWebhooks > 0,
      statusText:
        zapierWebhooks === 1 ? "1 zap" : zapierWebhooks === 0 ? "Not Connected" : `${zapierWebhooks} zaps`,
    },
    {
      connectHref: `/environments/${params.environmentId}/integrations/webhooks`,
      connectText: "Manage Webhooks",
      connectNewTab: false,
      docsHref: "https://formbricks.com/docs/webhook-api/overview",
      docsText: "Docs",
      docsNewTab: true,
      label: "Webhooks",
      description: "Trigger Webhooks based on actions in your surveys",
      icon: <Image src={WebhookLogo} alt="Webhook Logo" />,
      connected: userWebhooks > 0,
      statusText:
        userWebhooks === 1 ? "1 webhook" : userWebhooks === 0 ? "Not Connected" : `${userWebhooks} zaps`,
    },
    {
      connectHref: `/environments/${params.environmentId}/integrations/google-sheets`,
      connectText: `${containsGoogleSheetIntegration ? "Manage Sheets" : "Connect"}`,
      connectNewTab: false,
      docsHref: "https://formbricks.com/docs/integrations/google-sheets",
      docsText: "Docs",
      docsNewTab: true,
      label: "Google Sheets",
      description: "Instantly populate your spreadsheets with survey data",
      icon: <Image src={GoogleSheetsLogo} alt="Google sheets Logo" />,
      connected: containsGoogleSheetIntegration ? true : false,
      statusText: containsGoogleSheetIntegration ? "Connected" : "Not Connected",
    },
    {
      docsHref: "https://formbricks.com/docs/integrations/n8n",
      docsText: "Docs",
      docsNewTab: true,
      connectHref: "https://n8n.io",
      connectText: "Connect",
      connectNewTab: true,
      label: "n8n",
      description: "Integrate Formbricks with 350+ apps via n8n",
      icon: <Image src={n8nLogo} alt="n8n Logo" />,
    },
    {
      docsHref: "https://formbricks.com/docs/integrations/make",
      docsText: "Docs",
      docsNewTab: true,
      connectHref: "https://www.make.com/en/integrations/formbricks",
      connectText: "Connect",
      connectNewTab: true,
      label: "Make.com",
      description: "Integrate Formbricks with 1000+ apps via Make",
      icon: <Image src={MakeLogo} alt="Make Logo" />,
    },
  ];

  return (
    <div>
      <h1 className="my-2 text-3xl font-bold text-slate-800">Integrations</h1>
      <p className="mb-6 text-slate-500">Connect Formbricks with your favorite tools.</p>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {integrationCards.map((card) => (
          <Card
            key={card.label}
            docsHref={card.docsHref}
            docsText={card.docsText}
            docsNewTab={card.docsNewTab}
            connectHref={card.connectHref}
            connectText={card.connectText}
            connectNewTab={card.connectNewTab}
            label={card.label}
            description={card.description}
            icon={card.icon}
            connected={card.connected}
            statusText={card.statusText}
          />
        ))}
      </div>
    </div>
  );
}
