import { TFnType } from "@tolgee/react";
import { TIntegrationType } from "@formbricks/types/integration";

export const getIntegrationDetails = (integrationType: TIntegrationType, t: TFnType) => {
  switch (integrationType) {
    case "googleSheets":
      return {
        text: t("environments.integrations.google_sheets.google_sheets_integration_description"),
        docsLink: "https://formbricks.com/docs/integrations/google-sheets",
        connectButtonLabel: t("environments.integrations.google_sheets.connect_with_google_sheets"),
        notConfiguredText: t(
          "environments.integrations.google_sheets.google_sheet_integration_is_not_configured"
        ),
      };
    case "airtable":
      return {
        text: t("environments.integrations.airtable.airtable_integration_description"),
        docsLink: "https://formbricks.com/docs/integrations/airtable",
        connectButtonLabel: t("environments.integrations.airtable.connect_with_airtable"),
        notConfiguredText: t("environments.integrations.airtable.airtable_integration_is_not_configured"),
      };
    case "notion":
      return {
        text: t("environments.integrations.notion.notion_integration_description"),
        docsLink: "https://formbricks.com/docs/integrations/notion",
        connectButtonLabel: t("environments.integrations.notion.connect_with_notion"),
        notConfiguredText: t("environments.integrations.notion.notion_integration_is_not_configured"),
      };
    case "slack":
      return {
        text: t("environments.integrations.slack.slack_integration_description"),
        docsLink: "https://formbricks.com/docs/integrations/slack",
        connectButtonLabel: t("environments.integrations.slack.connect_with_slack"),
        notConfiguredText: t("environments.integrations.slack.slack_integration_is_not_configured"),
      };
    case "plain":
      return {
        text: t("environments.integrations.plain.plain_integration_description"),
        docsLink: "https://formbricks.com/docs/integrations/plain",
        connectButtonLabel: t("environments.integrations.plain.connect_with_plain"),
        notConfiguredText: t("environments.integrations.plain.plain_integration_is_not_configured"),
      };
  }
};
