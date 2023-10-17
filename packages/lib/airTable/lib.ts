import { TAirTableIntegration } from "@formbricks/types/v1/integrations";

export function isAirtableIntegration(integration: any): integration is TAirTableIntegration {
  const type: TAirTableIntegration["type"] = "airtable";
  return integration.type === type;
}
