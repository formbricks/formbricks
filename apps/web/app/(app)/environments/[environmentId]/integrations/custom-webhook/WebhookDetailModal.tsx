import ModalWithTabs from "@/components/shared/ModalWithTabs";
import { CodeBracketIcon } from "@heroicons/react/24/solid";
import { TWebhook } from "@formbricks/types/v1/webhooks";
import WebhookActivityTab from "@/app/(app)/environments/[environmentId]/integrations/custom-webhook/WebhookActivityTab";
import WebhookSettingsTab from "@/app/(app)/environments/[environmentId]/integrations/custom-webhook/WebhookSettingsTab";
import { TSurvey } from "@formbricks/types/v1/surveys";

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
      title: "Activity",
      children: <WebhookActivityTab webhook={webhook} surveys={surveys} />,
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
        icon={<CodeBracketIcon />}
        label={webhook.url}
        description={""}
      />
    </>
  );
}
