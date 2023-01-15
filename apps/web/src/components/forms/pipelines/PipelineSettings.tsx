"use client";

import { EmailNotificationSettings } from "./emailNotification";
import { WebhookSettings } from "./webhook";
import { SlackNotificationSettings } from "./slackNotification";

const PipelineSettings = ({ typeId, pipeline, setPipeline }) => {
  switch (typeId) {
    case "emailNotification":
      return <EmailNotificationSettings pipeline={pipeline} setPipeline={setPipeline} />;
    case "slackNotification":
      return <SlackNotificationSettings pipeline={pipeline} setPipeline={setPipeline} />;
    case "webhook":
      return <WebhookSettings pipeline={pipeline} setPipeline={setPipeline} />;
    default:
      return <></>;
  }
};

export default PipelineSettings;
