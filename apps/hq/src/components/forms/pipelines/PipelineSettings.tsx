"use client";

import { EmailNotificationSettings } from "./emailNotification";
import { WebhookSettings } from "./webhook";

const PipelineSettings = ({ typeId, pipeline, setPipeline }) => {
  switch (typeId) {
    case "webhook":
      return <WebhookSettings pipeline={pipeline} setPipeline={setPipeline} />;
      break;
    case "emailNotification":
      return <EmailNotificationSettings pipeline={pipeline} setPipeline={setPipeline} />;
    default:
      return <></>;
  }
};

export default PipelineSettings;
