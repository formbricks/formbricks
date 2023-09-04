import { IAuthenticateGeneric, ICredentialTestRequest, ICredentialType, INodeProperties } from "n8n-workflow";

export class FormbricksApi implements ICredentialType {
  name = "formbricksApi";
  displayName = "Formbricks API";
  properties: INodeProperties[] = [
    {
      displayName: "Host",
      name: "host",
      description:
        'The address of your Formbricks instance. For Formbricks Cloud this is "https://app.formbricks.com". If you are hosting Formbricks yourself, it\'s the address where you can reach your instance.',
      type: "string",
      default: "https://app.formbricks.com",
    },
    {
      displayName: "API Key",
      name: "apiKey",
      description:
        'Your Formbricks API-Key. You can create a new API-Key in the Product Settings. Please read our <a href="https://formbricks.com/docs/api/api-key-setup">API Key Docs</a> for more details.',
      type: "string",
      typeOptions: { password: true },
      default: "",
    },
  ];

  authenticate: IAuthenticateGeneric = {
    type: "generic",
    properties: {
      headers: {
        "x-Api-Key": "={{$credentials.apiKey}}",
      },
    },
  };
  test: ICredentialTestRequest | undefined = {
    request: {
      baseURL: "={{$credentials.host}}/api/v1",
      url: "=/me",
    },
  };
}
