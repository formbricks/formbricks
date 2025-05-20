import { getWebhookCountBySource } from "@/app/(app)/environments/[environmentId]/integrations/lib/webhook";
import ActivePiecesLogo from "@/images/activepieces.webp";
import AirtableLogo from "@/images/airtableLogo.svg";
import GoogleSheetsLogo from "@/images/googleSheetsLogo.png";
import JsLogo from "@/images/jslogo.png";
import MakeLogo from "@/images/make-small.png";
import n8nLogo from "@/images/n8n.png";
import notionLogo from "@/images/notion.png";
import PlainCom from "@/images/plain.webp";
import SlackLogo from "@/images/slacklogo.png";
import WebhookLogo from "@/images/webhook.png";
import ZapierLogo from "@/images/zapier-small.png";
import { getIntegrations } from "@/lib/integration/service";
import { getEnvironmentAuth } from "@/modules/environments/lib/utils";
import { Card } from "@/modules/ui/components/integration-card";
import { PageContentWrapper } from "@/modules/ui/components/page-content-wrapper";
import { PageHeader } from "@/modules/ui/components/page-header";
import { getTranslate } from "@/tolgee/server";
import Image from "next/image";
import { redirect } from "next/navigation";
import { TIntegrationType } from "@formbricks/types/integration";

const Page = async (props) => {
  const params = await props.params;
  const t = await getTranslate();

  const { isReadOnly, environment, isBilling } = await getEnvironmentAuth(params.environmentId);

  const [
    integrations,
    userWebhookCount,
    zapierWebhookCount,
    makeWebhookCount,
    n8nwebhookCount,
    activePiecesWebhookCount,
  ] = await Promise.all([
    getIntegrations(params.environmentId),
    getWebhookCountBySource(params.environmentId, "user"),
    getWebhookCountBySource(params.environmentId, "zapier"),
    getWebhookCountBySource(params.environmentId, "make"),
    getWebhookCountBySource(params.environmentId, "n8n"),
    getWebhookCountBySource(params.environmentId, "activepieces"),
  ]);

  const isIntegrationConnected = (type: TIntegrationType) =>
    integrations.some((integration) => integration.type === type);

  if (isBilling) {
    return redirect(`/environments/${params.environmentId}/settings/billing`);
  }

  const isGoogleSheetsIntegrationConnected = isIntegrationConnected("googleSheets");
  const isNotionIntegrationConnected = isIntegrationConnected("notion");
  const isAirtableIntegrationConnected = isIntegrationConnected("airtable");
  const isN8nIntegrationConnected = isIntegrationConnected("n8n");
  const isSlackIntegrationConnected = isIntegrationConnected("slack");

  const widgetSetupCompleted = !!environment?.appSetupCompleted;
  const integrationCards = [
    {
      docsHref: "https://formbricks.com/docs/xm-and-surveys/core-features/integrations/zapier",
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
      disabled: isReadOnly,
    },
    {
      connectHref: `/environments/${params.environmentId}/integrations/webhooks`,
      connectText: t("environments.integrations.manage_webhooks"),
      connectNewTab: false,
      docsHref: "https://formbricks.com/docs/xm-and-surveys/core-features/integrations/webhooks",
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
      disabled: false,
    },
    {
      connectHref: `/environments/${params.environmentId}/integrations/google-sheets`,
      connectText: `${isGoogleSheetsIntegrationConnected ? t("common.manage") : t("common.connect")}`,
      connectNewTab: false,
      docsHref: "https://formbricks.com/docs/xm-and-surveys/core-features/integrations/google-sheets",
      docsText: t("common.docs"),
      docsNewTab: true,
      label: "Google Sheets",
      description: t("environments.integrations.google_sheet_integration_description"),
      icon: <Image src={GoogleSheetsLogo} alt="Google sheets Logo" />,
      connected: isGoogleSheetsIntegrationConnected,
      statusText: isGoogleSheetsIntegrationConnected ? t("common.connected") : t("common.not_connected"),
      disabled: isReadOnly,
    },
    {
      connectHref: `/environments/${params.environmentId}/integrations/airtable`,
      connectText: `${isAirtableIntegrationConnected ? t("common.manage") : t("common.connect")}`,
      connectNewTab: false,
      docsHref: "https://formbricks.com/docs/xm-and-surveys/core-features/integrations/airtable",
      docsText: t("common.docs"),
      docsNewTab: true,
      label: "Airtable",
      description: t("environments.integrations.airtable_integration_description"),
      icon: <Image src={AirtableLogo} alt="Airtable Logo" />,
      connected: isAirtableIntegrationConnected,
      statusText: isAirtableIntegrationConnected ? t("common.connected") : t("common.not_connected"),
      disabled: isReadOnly,
    },
    {
      connectHref: `/environments/${params.environmentId}/integrations/slack`,
      connectText: `${isSlackIntegrationConnected ? t("common.manage") : t("common.connect")}`,
      connectNewTab: false,
      docsHref: "https://formbricks.com/docs/xm-and-surveys/core-features/integrations/slack",
      docsText: t("common.docs"),
      docsNewTab: true,
      label: "Slack",
      description: t("environments.integrations.slack_integration_description"),
      icon: <Image src={SlackLogo} alt="Slack Logo" />,
      connected: isSlackIntegrationConnected,
      statusText: isSlackIntegrationConnected ? t("common.connected") : t("common.not_connected"),
      disabled: isReadOnly,
    },
    {
      docsHref: "https://formbricks.com/docs/xm-and-surveys/core-features/integrations/n8n",
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
      disabled: isReadOnly,
    },
    {
      docsHref: "https://formbricks.com/docs/xm-and-surveys/core-features/integrations/make",
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
      disabled: isReadOnly,
    },
    {
      connectHref: `/environments/${params.environmentId}/integrations/notion`,
      connectText: `${isNotionIntegrationConnected ? t("common.manage") : t("common.connect")}`,
      connectNewTab: false,
      docsHref: "https://formbricks.com/docs/xm-and-surveys/core-features/integrations/notion",
      docsText: t("common.docs"),
      docsNewTab: true,
      label: "Notion",
      description: t("environments.integrations.notion_integration_description"),
      icon: <Image src={notionLogo} alt="Notion Logo" />,
      connected: isNotionIntegrationConnected,
      statusText: isNotionIntegrationConnected ? t("common.connected") : t("common.not_connected"),
      disabled: isReadOnly,
    },
    {
      docsHref: "https://formbricks.com/docs/xm-and-surveys/core-features/integrations/activepieces",
      docsText: t("common.docs"),
      docsNewTab: true,
      connectHref: "https://www.activepieces.com/pieces/formbricks",
      connectText: t("common.connect"),
      connectNewTab: true,
      label: "Activepieces",
      description: t("environments.integrations.activepieces_integration_description"),
      icon: <Image src={ActivePiecesLogo} alt="ActivePieces Logo" />,
      connected: activePiecesWebhookCount > 0,
      statusText:
        activePiecesWebhookCount === 1
          ? `1 ${t("common.integration")}`
          : activePiecesWebhookCount === 0
            ? t("common.not_connected")
            : `${activePiecesWebhookCount} ${t("common.integrations")}`,
      disabled: isReadOnly,
    },
    {
      docsHref: "https://formbricks.com/docs/xm-and-surveys/core-features/integrations/activepieces",
      docsText: t("common.docs"),
      docsNewTab: true,
      connectHref: `/environments/${params.environmentId}/integrations/plain`,
      connectText: t("common.connect"),
      connectNewTab: true,
      label: "Plain",
      description: t("environments.integrations.plain.plain_integration_description"),
      icon: <Image src={PlainCom} alt="Plain.com Logo" />,
      connected: activePiecesWebhookCount > 0,
      statusText:
        activePiecesWebhookCount === 1
          ? `1 ${t("common.integration")}`
          : activePiecesWebhookCount === 0
            ? t("common.not_connected")
            : `${activePiecesWebhookCount} ${t("common.integrations")}`,
      disabled: isReadOnly,
    },
  ];

  integrationCards.unshift({
    docsHref: "https://formbricks.com/docs/app-surveys/quickstart",
    docsText: t("common.docs"),
    docsNewTab: true,
    connectHref: `/environments/${params.environmentId}/project/app-connection`,
    connectText: t("common.connect"),
    connectNewTab: false,
    label: "Javascript SDK",
    description: t("environments.integrations.website_or_app_integration_description"),
    icon: <Image src={JsLogo} alt="Javascript Logo" />,
    connected: widgetSetupCompleted,
    statusText: widgetSetupCompleted ? t("common.connected") : t("common.not_connected"),
    disabled: false,
  });

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
            disabled={card.disabled}
          />
        ))}
      </div>
    </PageContentWrapper>
  );
};

export default Page;
