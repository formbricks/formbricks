import { z } from "zod";

// this file defines the data contract for a workflow action and its fields.

export type FieldDescriptor = {
  key: string;
  label: string;
  kind: "text" | "textarea";
  required?: boolean;
  acceptsDataRefs?: boolean;
  placeholder?: string;
  help?: string;
};

export type ActionDescriptor = {
  integration: string;
  operation: string;
  label: string;
  icon: string;
  category: "messaging" | "crm" | "storage" | "http" | "email";
  configSchema: z.ZodType;
  fields: FieldDescriptor[];
};

const slackSendChannelMessage: ActionDescriptor = {
  integration: "slack",
  operation: "sendChannelMessage",
  label: "Send Slack message",
  icon: "message-square",
  category: "messaging",
  configSchema: z.object({
    channel: z.string().min(1, "Channel is required"),
    text: z.string().min(1, "Message is required"),
  }),
  fields: [
    {
      key: "channel",
      label: "Channel",
      kind: "text",
      required: true,
      placeholder: "#promoters",
    },
    {
      key: "text",
      label: "Message",
      kind: "textarea",
      required: true,
      acceptsDataRefs: true,
      placeholder: "Nice NPS {{answers.nps}} from {{response.email}}",
    },
  ],
};

const actionDescriptors: ActionDescriptor[] = [slackSendChannelMessage];

export function listActionDescriptors(): ActionDescriptor[] {
  return actionDescriptors;
}

export function findActionDescriptor(integration: string, operation: string): ActionDescriptor | undefined {
  return actionDescriptors.find(
    (descriptor) => descriptor.integration === integration && descriptor.operation === operation
  );
}
