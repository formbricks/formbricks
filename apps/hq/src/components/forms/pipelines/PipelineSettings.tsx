"use client";

import { EmailNotificationSettings } from "./emailNotification";
import { WebhookSettings } from "./webhook";

const PipelineSettings = ({ typeId, pipeline, setPipeline }) => {
  switch (typeId) {
    case "WEBHOOK":
      return <WebhookSettings pipeline={pipeline} setPipeline={setPipeline} />;
      break;
    case "EMAIL_NOTIFICATION":
      return <EmailNotificationSettings pipeline={pipeline} setPipeline={setPipeline} />;
    default:
      return <></>;
  }
};

export default PipelineSettings;
