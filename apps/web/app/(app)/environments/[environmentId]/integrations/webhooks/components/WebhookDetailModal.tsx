import { WebhookOverviewTab } from "@/app/(app)/environments/[environmentId]/integrations/webhooks/components/WebhookOverviewTab";
import { WebhookSettingsTab } from "@/app/(app)/environments/[environmentId]/integrations/webhooks/components/WebhookSettingsTab";
import { Webhook } from "lucide-react";
import { TSurvey } from "@formbricks/types/surveys/types";
import { TWebhook } from "@formbricks/types/webhooks";
import { ModalWithTabs } from "@formbricks/ui/ModalWithTabs";

interface WebhookModalProps {
  open: boolean;
  setOpen: (v: boolean) => void;
  webhook: TWebhook;
  surveys: TSurvey[];
}

export const WebhookModal = ({ open, setOpen, webhook, surveys }: WebhookModalProps) => {
  const tabs = [
    {
      title: "Overview",
      children: <WebhookOverviewTab webhook={webhook} surveys={surveys} />,
    },
    {
      title: "Settings",
      children: <WebhookSettingsTab webhook={webhook} surveys={surveys} setOpen={setOpen} />,
    },
  ];

  return (
    <>
      <ModalWithTabs
        open={open}
        setOpen={setOpen}
        tabs={tabs}
        icon={<Webhook />}
        label={webhook.name ? webhook.name : webhook.url}
        description={""}
      />
    </>
  );
};
