import { TFunction } from "i18next";
import { TIntegrationType } from "@formbricks/types/integration";

export const getIntegrationDetails = (integrationType: TIntegrationType, t: TFunction) => {
  switch (integrationType) {
    case "googleSheets":
      return {
        text: t("workspace.integrations.google_sheets.google_sheets_integration_description"),
        docsLink: "https://formbricks.com/docs/integrations/google-sheets",
        connectButtonLabel: t("workspace.integrations.google_sheets.connect_with_google_sheets"),
        notConfiguredText: t(
          "workspace.integrations.google_sheets.google_sheet_integration_is_not_configured"
        ),
      };
    case "airtable":
      return {
        text: t("workspace.integrations.airtable.airtable_integration_description"),
        docsLink: "https://formbricks.com/docs/integrations/airtable",
        connectButtonLabel: t("workspace.integrations.airtable.connect_with_airtable"),
        notConfiguredText: t("workspace.integrations.airtable.airtable_integration_is_not_configured"),
      };
    case "notion":
      return {
        text: t("workspace.integrations.notion.notion_integration_description"),
        docsLink: "https://formbricks.com/docs/integrations/notion",
        connectButtonLabel: t("workspace.integrations.notion.connect_with_notion"),
        notConfiguredText: t("workspace.integrations.notion.notion_integration_is_not_configured"),
      };
    case "slack":
      return {
        text: t("workspace.integrations.slack.slack_integration_description"),
        docsLink: "https://formbricks.com/docs/integrations/slack",
        connectButtonLabel: t("workspace.integrations.slack.connect_with_slack"),
        notConfiguredText: t("workspace.integrations.slack.slack_integration_is_not_configured"),
      };
  }
};
