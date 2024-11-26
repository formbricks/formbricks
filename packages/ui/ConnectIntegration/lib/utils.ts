import { TIntegrationType } from "@formbricks/types/integration";

export const getIntegrationDetails = (integrationType: TIntegrationType) => {
  switch (integrationType) {
    case "googleSheets":
      return {
        text: "Sync responses directly with Google Sheets.",
        docsLink: "https://formbricks.com/docs/integrations/google-sheets",
        connectButtonLabel: "Connect with Google Sheets",
        notConfiguredText: "Google Sheet Integration is not configured in your instance of Formbricks.",
      };
    case "airtable":
      return {
        text: "Sync responses directly with Airtable.",
        docsLink: "https://formbricks.com/docs/integrations/airtable",
        connectButtonLabel: "Connect with Airtable",
        notConfiguredText: "Airtable Integration is not configured in your instance of Formbricks.",
      };
    case "notion":
      return {
        text: "Sync responses directly with your Notion database.",
        docsLink: "https://formbricks.com/docs/integrations/notion",
        connectButtonLabel: "Connect with Notion",
        notConfiguredText: "Notion Integration is not configured in your instance of Formbricks.",
      };
    case "slack":
      return {
        text: "Send responses directly to Slack.",
        docsLink: "https://formbricks.com/docs/integrations/slack",
        connectButtonLabel: "Connect with Slack",
        notConfiguredText: "Slack Integration is not configured in your instance of Formbricks.",
      };
  }
};
