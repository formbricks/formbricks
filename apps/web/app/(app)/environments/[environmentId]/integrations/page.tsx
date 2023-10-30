import AirtableLogo from "./airtable/images/airtable.svg";
import GoogleSheetsLogo from "./google-sheets/images/google-sheets-small.png";
import JsLogo from "@/images/jslogo.png";
import MakeLogo from "@/images/make-small.png";
import n8nLogo from "@/images/n8n.png";
import WebhookLogo from "@/images/webhook.png";
import ZapierLogo from "@/images/zapier-small.png";
import notionLogo from "@/images/notion.png";
import Image from "next/image";
import { Card } from "@formbricks/ui/Card";
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

  const isIntegrationConnected = (type: "googleSheets" | "notion") =>
    integrations.some((integration) => integration.type === type);

  const isGoogleSheetsIntegrationConnected = isIntegrationConnected("googleSheets");

  const isNotionIntegrationConnected = isIntegrationConnected("notion");

  const isAirtableIntegrationConnected = integrations.some((integration) => integration.type === "airtable");

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
        userWebhooks === 1 ? "1 webhook" : userWebhooks === 0 ? "Not Connected" : `${userWebhooks} webhooks`,
    },
    {
      connectHref: `/environments/${params.environmentId}/integrations/google-sheets`,
      connectText: `${isGoogleSheetsIntegrationConnected ? "Manage Sheets" : "Connect"}`,
      connectNewTab: false,
      docsHref: "https://formbricks.com/docs/integrations/google-sheets",
      docsText: "Docs",
      docsNewTab: true,
      label: "Google Sheets",
      description: "Instantly populate your spreadsheets with survey data",
      icon: <Image src={GoogleSheetsLogo} alt="Google sheets Logo" />,
      connected: isGoogleSheetsIntegrationConnected,
      statusText: isGoogleSheetsIntegrationConnected ? "Connected" : "Not Connected",
    },
    {
      connectHref: `/environments/${params.environmentId}/integrations/airtable`,
      connectText: `${isAirtableIntegrationConnected ? "Manage Table" : "Connect"}`,
      connectNewTab: false,
      docsHref: "https://formbricks.com/docs/integrations/airtable",
      docsText: "Docs",
      docsNewTab: true,
      label: "Airtable",
      description: "Instantly populate your airtable table with survey data",
      icon: <Image src={AirtableLogo} alt="Airtable Logo" />,
      connected: isAirtableIntegrationConnected,
      statusText: isAirtableIntegrationConnected ? "Connected" : "Not Connected",
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
    {
      connectHref: `/environments/${params.environmentId}/integrations/notion`,
      connectText: `${isNotionIntegrationConnected ? "Manage" : "Connect"}`,
      connectNewTab: false,
      docsHref: "https://formbricks.com/docs/integrations/notion",
      docsText: "Docs",
      docsNewTab: true,
      label: "Notion",
      description: "Send data to your Notion database",
      icon: <Image src={notionLogo} alt="Notion Logo" />,
      connected: isNotionIntegrationConnected,
      statusText: isNotionIntegrationConnected ? "Connected" : "Not Connected",
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
