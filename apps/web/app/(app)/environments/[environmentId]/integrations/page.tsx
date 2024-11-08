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
import { getTranslations } from "next-intl/server";
import Image from "next/image";
import { authOptions } from "@formbricks/lib/authOptions";
import { getEnvironment } from "@formbricks/lib/environment/service";
import { getIntegrations } from "@formbricks/lib/integration/service";
import { getMembershipByUserIdOrganizationId } from "@formbricks/lib/membership/service";
import { getAccessFlags } from "@formbricks/lib/membership/utils";
import { getOrganizationByEnvironmentId } from "@formbricks/lib/organization/service";
import { getWebhookCountBySource } from "@formbricks/lib/webhook/service";
import { TIntegrationType } from "@formbricks/types/integration";
import { ErrorComponent } from "@formbricks/ui/components/ErrorComponent";
import { Card } from "@formbricks/ui/components/IntegrationCard";
import { PageContentWrapper } from "@formbricks/ui/components/PageContentWrapper";
import { PageHeader } from "@formbricks/ui/components/PageHeader";

const Page = async ({ params }) => {
  const environmentId = params.environmentId;
  const t = await getTranslations();
  const [
    environment,
    integrations,
    organization,
    session,
    userWebhookCount,
    zapierWebhookCount,
    makeWebhookCount,
    n8nwebhookCount,
  ] = await Promise.all([
    getEnvironment(environmentId),
    getIntegrations(environmentId),
    getOrganizationByEnvironmentId(params.environmentId),
    getServerSession(authOptions),
    getWebhookCountBySource(environmentId, "user"),
    getWebhookCountBySource(environmentId, "zapier"),
    getWebhookCountBySource(environmentId, "make"),
    getWebhookCountBySource(environmentId, "n8n"),
  ]);

  const isIntegrationConnected = (type: TIntegrationType) =>
    integrations.some((integration) => integration.type === type);
  if (!session) {
    throw new Error(t("common.session_not_found"));
  }

  if (!organization) {
    throw new Error(t("common.organization_not_found"));
  }

  const currentUserMembership = await getMembershipByUserIdOrganizationId(session?.user.id, organization.id);
  const { isViewer } = getAccessFlags(currentUserMembership?.role);

  const isGoogleSheetsIntegrationConnected = isIntegrationConnected("googleSheets");
  const isNotionIntegrationConnected = isIntegrationConnected("notion");
  const isAirtableIntegrationConnected = isIntegrationConnected("airtable");
  const isN8nIntegrationConnected = isIntegrationConnected("n8n");
  const isSlackIntegrationConnected = isIntegrationConnected("slack");

  const widgetSetupCompleted = !!environment?.appSetupCompleted;
  const integrationCards = [
    {
      docsHref: "https://formbricks.com/docs/integrations/zapier",
      docsText: t("common.docs"),
      docsNewTab: true,
      connectHref: "https://zapier.com/apps/formbricks/integrations",
      connectText: t("common.connect"),
      connectNewTab: true,
      label: "Zapier",
      description: t("environments.integrations.zapier_integration_description"),
      icon: <Image src={ZapierLogo} alt="Zapier Logo" />,
      connected: zapierWebhookCount > 0,
      statusText:
        zapierWebhookCount === 1
          ? "1 zap"
          : zapierWebhookCount === 0
            ? t("common.not_connected")
            : `${zapierWebhookCount} zaps`,
    },
    {
      connectHref: `/environments/${params.environmentId}/integrations/webhooks`,
      connectText: t("environments.integrations.manage_webhooks"),
      connectNewTab: false,
      docsHref: "https://formbricks.com/docs/api/management/webhooks",
      docsText: t("common.docs"),
      docsNewTab: true,
      label: "Webhooks",
      description: t("environments.integrations.webhook_integration_description"),
      icon: <Image src={WebhookLogo} alt="Webhook Logo" />,
      connected: userWebhookCount > 0,
      statusText:
        userWebhookCount === 1
          ? "1 webhook"
          : userWebhookCount === 0
            ? t("common.not_connected")
            : `${userWebhookCount} webhooks`,
    },
    {
      connectHref: `/environments/${params.environmentId}/integrations/google-sheets`,
      connectText: `${isGoogleSheetsIntegrationConnected ? t("common.manage") : t("common.connect")}`,
      connectNewTab: false,
      docsHref: "https://formbricks.com/docs/integrations/google-sheets",
      docsText: t("common.docs"),
      docsNewTab: true,
      label: "Google Sheets",
      description: t("environments.integrations.google_sheet_integration_description"),
      icon: <Image src={GoogleSheetsLogo} alt="Google sheets Logo" />,
      connected: isGoogleSheetsIntegrationConnected,
      statusText: isGoogleSheetsIntegrationConnected ? t("common.connected") : t("common.not_connected"),
    },
    {
      connectHref: `/environments/${params.environmentId}/integrations/airtable`,
      connectText: `${isAirtableIntegrationConnected ? t("common.manage") : t("common.connect")}`,
      connectNewTab: false,
      docsHref: "https://formbricks.com/docs/integrations/airtable",
      docsText: t("common.docs"),
      docsNewTab: true,
      label: "Airtable",
      description: t("environments.integrations.airtable_integration_description"),
      icon: <Image src={AirtableLogo} alt="Airtable Logo" />,
      connected: isAirtableIntegrationConnected,
      statusText: isAirtableIntegrationConnected ? t("common.connected") : t("common.not_connected"),
    },
    {
      connectHref: `/environments/${params.environmentId}/integrations/slack`,
      connectText: `${isSlackIntegrationConnected ? t("common.manage") : t("common.connect")}`,
      connectNewTab: false,
      docsHref: "https://formbricks.com/docs/integrations/slack",
      docsText: t("common.docs"),
      docsNewTab: true,
      label: "Slack",
      description: t("environments.integrations.slack_integration_description"),
      icon: <Image src={SlackLogo} alt="Slack Logo" />,
      connected: isSlackIntegrationConnected,
      statusText: isSlackIntegrationConnected ? t("common.connected") : t("common.not_connected"),
    },
    {
      docsHref: "https://formbricks.com/docs/integrations/n8n",
      connectText: `${isN8nIntegrationConnected ? t("common.manage") : t("common.connect")}`,
      docsText: t("common.docs"),
      docsNewTab: true,
      connectHref: "https://n8n.io",
      connectNewTab: true,
      label: "n8n",
      description: t("environments.integrations.n8n_integration_description"),
      icon: <Image src={n8nLogo} alt="n8n Logo" />,
      connected: n8nwebhookCount > 0,
      statusText:
        n8nwebhookCount === 1
          ? `1 ${t("common.integration")}`
          : n8nwebhookCount === 0
            ? t("common.not_connected")
            : `${n8nwebhookCount} ${t("common.integrations")}`,
    },
    {
      docsHref: "https://formbricks.com/docs/integrations/make",
      docsText: t("common.docs"),
      docsNewTab: true,
      connectHref: "https://www.make.com/en/integrations/formbricks",
      connectText: t("common.connect"),
      connectNewTab: true,
      label: "Make.com",
      description: t("environments.integrations.make_integration_description"),
      icon: <Image src={MakeLogo} alt="Make Logo" />,
      connected: makeWebhookCount > 0,
      statusText:
        makeWebhookCount === 1
          ? `1 ${t("common.integration")}`
          : makeWebhookCount === 0
            ? t("common.not_connected")
            : `${makeWebhookCount} ${t("common.integrations")}`,
    },
    {
      connectHref: `/environments/${params.environmentId}/integrations/notion`,
      connectText: `${isNotionIntegrationConnected ? t("common.manage") : t("common.connect")}`,
      connectNewTab: false,
      docsHref: "https://formbricks.com/docs/integrations/notion",
      docsText: t("common.docs"),
      docsNewTab: true,
      label: "Notion",
      description: t("environments.integrations.notion_integration_description"),
      icon: <Image src={notionLogo} alt="Notion Logo" />,
      connected: isNotionIntegrationConnected,
      statusText: isNotionIntegrationConnected ? t("common.connected") : t("common.not_connected"),
    },
  ];

  integrationCards.unshift({
    docsHref: "https://formbricks.com/docs/app-surveys/quickstart",
    docsText: t("common.docs"),
    docsNewTab: true,
    connectHref: `/environments/${environmentId}/product/app-connection`,
    connectText: t("common.connect"),
    connectNewTab: false,
    label: "Javascript SDK",
    description: t("environments.integrations.website_or_app_integration_description"),
    icon: <Image src={JsLogo} alt="Javascript Logo" />,
    connected: widgetSetupCompleted,
    statusText: widgetSetupCompleted ? t("common.connected") : t("common.not_connected"),
  });

  if (isViewer) return <ErrorComponent />;

  return (
    <PageContentWrapper>
      <PageHeader pageTitle={t("common.integrations")} />
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
