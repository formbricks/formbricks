import { INodeType, INodeTypeDescription, IWebhookFunctions, IWebhookResponseData } from "n8n-workflow";

import { apiRequest, getSurveys } from "./GenericFunctions";
import { IHookFunctions } from "n8n-core";

export class Formbricks implements INodeType {
  description: INodeTypeDescription = {
    displayName: "Formbricks",
    name: "formbricks",
    icon: "file:formbricks.svg",
    group: ["trigger"],
    version: 1,
    subtitle: '=Surveys: {{$parameter["surveyIds"]}}',
    description: "Open Source Surveys & Experience Management Solution",
    defaults: {
      name: "Formbricks",
    },
    // eslint-disable-next-line n8n-nodes-base/node-class-description-inputs-wrong-regular-node
    inputs: [],
    outputs: ["main"],
    credentials: [
      {
        name: "formbricksApi",
        required: true,
      },
    ],
    webhooks: [
      {
        name: "default",
        httpMethod: "POST",
        responseMode: "onReceived",
        path: "webhook",
      },
    ],
    properties: [
      {
        displayName: "Events",
        name: "events",
        type: "multiOptions",
        options: [
          {
            name: "Response Created",
            value: "responseCreated",
            description:
              "Triggers when a new response is created for a survey. Normally triggered after the first question was answered.",
          },
          {
            name: "Response Updated",
            value: "responseUpdated",
            description: "Triggers when a response is updated within a survey",
          },
          {
            name: "Response Finished",
            value: "responseFinished",
            description: "Triggers when a response is marked as finished",
          },
        ],
        default: [],
        required: true,
      },
      {
        // eslint-disable-next-line n8n-nodes-base/node-param-display-name-wrong-for-dynamic-multi-options
        displayName: "Survey",
        name: "surveyIds",
        // eslint-disable-next-line n8n-nodes-base/node-param-description-wrong-for-dynamic-multi-options
        description:
          'Survey which should trigger workflow. Only trigger this node for a specific survey within the environment. Choose from the list, or specify an ID using an <a href="https://docs.n8n.io/code-examples/expressions/">expression</a>.',
        type: "multiOptions",
        typeOptions: {
          loadOptionsMethod: "getSurveys",
        },
        options: [],
        default: [],
        required: true,
      },
    ],
  };
  methods = {
    loadOptions: {
      getSurveys,
    },
  };

  webhookMethods = {
    default: {
      async checkExists(this: IHookFunctions): Promise<boolean> {
        const webhookData = this.getWorkflowStaticData("node");
        const webhookUrl = this.getNodeWebhookUrl("default");
        const surveyIds = this.getNodeParameter("surveyIds") as Array<string>;

        const endpoint = "/webhooks";

        try {
          const response = await apiRequest.call(this, "GET", endpoint, {});
          for (const webhook of response.data) {
            for (const surveyId of webhook.surveyIds) {
              if (surveyIds.includes(surveyId) && webhook.url === webhookUrl) {
                webhookData.webhookId = webhook.id;
                return true;
              }
            }
          }
        } catch (error) {
          return false;
        }
        return false;
      },
      async create(this: IHookFunctions): Promise<boolean> {
        const webhookData = this.getWorkflowStaticData("node");
        const webhookUrl = this.getNodeWebhookUrl("default");
        const surveyIds = this.getNodeParameter("surveyIds") as Array<string>;
        const events = this.getNodeParameter("events");

        const body = {
          url: webhookUrl,
          triggers: events,
          surveyIds: surveyIds,
          source: "n8n",
        };
        const endpoint = "/webhooks";

        try {
          const response = await apiRequest.call(this, "POST", endpoint, body);
          webhookData.webhookId = response.data.id;
          return true;
        } catch (error) {
          return false;
        }
      },
      async delete(this: IHookFunctions): Promise<boolean> {
        const webhookData = this.getWorkflowStaticData("node");
        if (webhookData.webhookId !== undefined) {
          const endpoint = `/webhooks/${webhookData.webhookId}`;

          try {
            await apiRequest.call(this, "DELETE", endpoint, {});
          } catch (error) {
            return false;
          }
          // Remove from the static workflow data so that it is clear
          // that no webhooks are registered anymore
          delete webhookData.webhookId;
        }
        return false;
      },
    },
  };

  async webhook(this: IWebhookFunctions): Promise<IWebhookResponseData> {
    const bodyData = this.getBodyData();
    // getting bodyData as string, so need to JSON parse it to convert to an object
    return {
      workflowData: [this.helpers.returnJsonArray(JSON.parse(bodyData as any))],
    };
  }
}
