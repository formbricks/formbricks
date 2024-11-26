import AirtableLogo from "@/images/airtableLogo.svg";
import GoogleSheetsLogo from "@/images/googleSheetsLogo.png";
import JsLogo from "@/images/jslogo.png";
import MakeLogo from "@/images/make-small.png";
import n8nLogo from "@/images/n8n.png";
import notionLogo from "@/images/notion.png";
import SlackLogo from "@/images/slacklogo.png";
import WebhookLogo from "@/images/webhook.png";
import ZapierLogo from "@/images/zapier-small.png";
import { getServerSession } from "next-auth";
import Image from "next/image";
import { authOptions } from "@formbricks/lib/authOptions";
import { getEnvironment } from "@formbricks/lib/environment/service";
import { getIntegrations } from "@formbricks/lib/integration/service";
import { getMembershipByUserIdOrganizationId } from "@formbricks/lib/membership/service";
import { getAccessFlags } from "@formbricks/lib/membership/utils";
import { getOrganizationByEnvironmentId } from "@formbricks/lib/organization/service";
import { getProductByEnvironmentId } from "@formbricks/lib/product/service";
import { getWebhookCountBySource } from "@formbricks/lib/webhook/service";
import { TIntegrationType } from "@formbricks/types/integration";
import { Card } from "@formbricks/ui/Card";
import { ErrorComponent } from "@formbricks/ui/ErrorComponent";
import { PageContentWrapper } from "@formbricks/ui/PageContentWrapper";
import { PageHeader } from "@formbricks/ui/PageHeader";

const Page = async ({ params }) => {
  const environmentId = params.environmentId;

  const [
    environment,
    integrations,
    organization,
    session,
    userWebhookCount,
    zapierWebhookCount,
    makeWebhookCount,
    n8nwebhookCount,
    product,
  ] = await Promise.all([
    getEnvironment(environmentId),
    getIntegrations(environmentId),
    getOrganizationByEnvironmentId(params.environmentId),
    getServerSession(authOptions),
    getWebhookCountBySource(environmentId, "user"),
    getWebhookCountBySource(environmentId, "zapier"),
    getWebhookCountBySource(environmentId, "make"),
    getWebhookCountBySource(environmentId, "n8n"),
    getProductByEnvironmentId(environmentId),
  ]);

  const isIntegrationConnected = (type: TIntegrationType) =>
    integrations.some((integration) => integration.type === type);
  if (!session) {
    throw new Error("Session not found");
  }

  if (!organization) {
    throw new Error("Organization not found");
  }

  const currentUserMembership = await getMembershipByUserIdOrganizationId(session?.user.id, organization.id);
  const { isViewer } = getAccessFlags(currentUserMembership?.role);

  const isGoogleSheetsIntegrationConnected = isIntegrationConnected("googleSheets");
  const isNotionIntegrationConnected = isIntegrationConnected("notion");
  const isAirtableIntegrationConnected = isIntegrationConnected("airtable");
  const isN8nIntegrationConnected = isIntegrationConnected("n8n");
  const isSlackIntegrationConnected = isIntegrationConnected("slack");

  const widgetSetupCompleted = !!environment?.appSetupCompleted || !!environment?.websiteSetupCompleted;
  const bothSetupCompleted = environment?.appSetupCompleted && environment?.websiteSetupCompleted;
  const productChannel =
    product?.config.channel === "website" || !product?.config.channel ? "website" : product?.config.channel;

  const integrationCards = [
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
      connectHref: `/environments/${params.environmentId}/integrations/slack`,
      connectText: `${isSlackIntegrationConnected ? "Manage" : "Connect"}`,
      connectNewTab: false,
      docsHref: "https://formbricks.com/docs/integrations/slack",
      docsText: "Docs",
      docsNewTab: true,
      label: "Slack",
      description: "Instantly Connect your Slack Workspace with Formbricks",
      icon: <Image src={SlackLogo} alt="Slack Logo" />,
      connected: isSlackIntegrationConnected,
      statusText: isSlackIntegrationConnected ? "Connected" : "Not Connected",
    },
    {
      docsHref: "https://formbricks.com/docs/integrations/n8n",
      connectText: `${isN8nIntegrationConnected ? "Manage" : "Connect"}`,
      docsText: "Docs",
      docsNewTab: true,
      connectHref: "https://n8n.io",
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

  if (productChannel !== "link") {
    integrationCards.unshift({
      docsHref: "https://formbricks.com/docs/getting-started/framework-guides#next-js",
      docsText: "Docs",
      docsNewTab: true,
      connectHref: `/environments/${environmentId}/product/${productChannel}-connection`,
      connectText: "Connect",
      connectNewTab: false,
      label: "Javascript Widget",
      description: "Integrate Formbricks into your Webapp",
      icon: <Image src={JsLogo} alt="Javascript Logo" />,
      connected: widgetSetupCompleted,
      statusText: bothSetupCompleted
        ? "app & website connected"
        : environment?.appSetupCompleted
          ? "app Connected"
          : environment?.websiteSetupCompleted
            ? "website connected"
            : "Not Connected",
    });
  }

  if (isViewer) return <ErrorComponent />;

  return (
    <PageContentWrapper>
      <PageHeader pageTitle="Integrations" />
      <div className="grid grid-cols-3 place-content-stretch gap-4 lg:grid-cols-3">
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
    </PageContentWrapper>
  );
};

export default Page;
