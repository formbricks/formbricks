import { describe, expect, test } from "vitest";
import { getIntegrationDetails } from "./utils";

describe("getIntegrationDetails", () => {
  const mockT = (key: string) => key;

  test("returns correct details for googleSheets integration", () => {
    const details = getIntegrationDetails("googleSheets", mockT as any);

    expect(details).toEqual({
      text: "environments.integrations.google_sheets.google_sheets_integration_description",
      docsLink: "https://formbricks.com/docs/integrations/google-sheets",
      connectButtonLabel: "environments.integrations.google_sheets.connect_with_google_sheets",
      notConfiguredText: "environments.integrations.google_sheets.google_sheet_integration_is_not_configured",
    });
  });

  test("returns correct details for airtable integration", () => {
    const details = getIntegrationDetails("airtable", mockT as any);

    expect(details).toEqual({
      text: "environments.integrations.airtable.airtable_integration_description",
      docsLink: "https://formbricks.com/docs/integrations/airtable",
      connectButtonLabel: "environments.integrations.airtable.connect_with_airtable",
      notConfiguredText: "environments.integrations.airtable.airtable_integration_is_not_configured",
    });
  });

  test("returns correct details for notion integration", () => {
    const details = getIntegrationDetails("notion", mockT as any);

    expect(details).toEqual({
      text: "environments.integrations.notion.notion_integration_description",
      docsLink: "https://formbricks.com/docs/integrations/notion",
      connectButtonLabel: "environments.integrations.notion.connect_with_notion",
      notConfiguredText: "environments.integrations.notion.notion_integration_is_not_configured",
    });
  });

  test("returns correct details for slack integration", () => {
    const details = getIntegrationDetails("slack", mockT as any);

    expect(details).toEqual({
      text: "environments.integrations.slack.slack_integration_description",
      docsLink: "https://formbricks.com/docs/integrations/slack",
      connectButtonLabel: "environments.integrations.slack.connect_with_slack",
      notConfiguredText: "environments.integrations.slack.slack_integration_is_not_configured",
    });
  });
});
