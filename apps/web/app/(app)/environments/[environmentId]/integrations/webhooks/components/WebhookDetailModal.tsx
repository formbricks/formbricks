import ModalWithTabs from "@formbricks/ui/ModalWithTabs";
import { TWebhook } from "@formbricks/types/v1/webhooks";
import WebhookOverviewTab from "@/app/(app)/environments/[environmentId]/integrations/webhooks/components/WebhookOverviewTab";
import WebhookSettingsTab from "@/app/(app)/environments/[environmentId]/integrations/webhooks/components/WebhookSettingsTab";
import { TSurvey } from "@formbricks/types/v1/surveys";
import { Webhook } from "lucide-react";

interface WebhookModalProps {
  environmentId: string;
  open: boolean;
  setOpen: (v: boolean) => void;
  webhook: TWebhook;
  surveys: TSurvey[];
}

export default function WebhookModal({ environmentId, open, setOpen, webhook, surveys }: WebhookModalProps) {
  const tabs = [
    {
      title: "Overview",
      children: <WebhookOverviewTab webhook={webhook} surveys={surveys} />,
    },
    {
      title: "Settings",
      children: (
        <WebhookSettingsTab
          environmentId={environmentId}
          webhook={webhook}
          surveys={surveys}
          setOpen={setOpen}
        />
      ),
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
}
