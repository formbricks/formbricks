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
import { getWebhookCountBySource } from "@formbricks/lib/webhook/service";
import { getEnvironment } from "@formbricks/lib/environment/service";
import { getIntegrations } from "@formbricks/lib/integration/service";
import { getTeamByEnvironmentId } from "@formbricks/lib/team/service";
import { getMembershipByUserIdTeamId } from "@formbricks/lib/membership/service";
import { authOptions } from "@formbricks/lib/authOptions";
import { getAccessFlags } from "@formbricks/lib/membership/utils";
import { getServerSession } from "next-auth";
import { ErrorComponent } from "@formbricks/ui/ErrorComponent";

export default async function IntegrationsPage({ params }) {
  const environmentId = params.environmentId;

  const [
    environment,
    integrations,
    team,
    session,
    userWebhookCount,
    zapierWebhookCount,
    makeWebhookCount,
    n8nwebhookCount,
  ] = await Promise.all([
    getEnvironment(environmentId),
    getIntegrations(environmentId),
    getTeamByEnvironmentId(params.environmentId),
    getServerSession(authOptions),
    getWebhookCountBySource(environmentId, "user"),
    getWebhookCountBySource(environmentId, "zapier"),
    getWebhookCountBySource(environmentId, "make"),
    getWebhookCountBySource(environmentId, "n8n"),
  ]);

  const isIntegrationConnected = (type: "googleSheets" | "notion") =>
    integrations.some((integration) => integration.type === type);
  if (!session) {
    throw new Error("Session not found");
  }

  if (!team) {
    throw new Error("Team not found");
  }

  const currentUserMembership = await getMembershipByUserIdTeamId(session?.user.id, team.id);
  const { isViewer } = getAccessFlags(currentUserMembership?.role);

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
      connected: zapierWebhookCount > 0,
      statusText:
        zapierWebhookCount === 1
          ? "1 zap"
          : zapierWebhookCount === 0
          ? "Not Connected"
          : `${zapierWebhookCount} zaps`,
    },
    {
      connectHref: `/environments/${params.environmentId}/integrations/webhooks`,
      connectText: "Manage Webhooks",
      connectNewTab: false,
      docsHref: "https://formbricks.com/docs/api/management/webhooks",
      docsText: "Docs",
      docsNewTab: true,
      label: "Webhooks",
      description: "Trigger Webhooks based on actions in your surveys",
      icon: <Image src={WebhookLogo} alt="Webhook Logo" />,
      connected: userWebhookCount > 0,
      statusText:
        userWebhookCount === 1
          ? "1 webhook"
          : userWebhookCount === 0
          ? "Not Connected"
          : `${userWebhookCount} webhooks`,
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
      connected: n8nwebhookCount > 0,
      statusText:
        n8nwebhookCount === 1
          ? "1 integration"
          : n8nwebhookCount === 0
          ? "Not Connected"
          : `${n8nwebhookCount} integrations`,
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
      connected: makeWebhookCount > 0,
      statusText:
        makeWebhookCount === 1
          ? "1 integration"
          : makeWebhookCount === 0
          ? "Not Connected"
          : `${makeWebhookCount} integration`,
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

  if (isViewer) return <ErrorComponent />;

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
