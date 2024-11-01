import { WebhookOverviewTab } from "@/app/(app)/environments/[environmentId]/integrations/webhooks/components/WebhookOverviewTab";
import { WebhookSettingsTab } from "@/app/(app)/environments/[environmentId]/integrations/webhooks/components/WebhookSettingsTab";
import { Webhook } from "lucide-react";
import { useTranslations } from "next-intl";
import { TSurvey } from "@formbricks/types/surveys/types";
import { TWebhook } from "@formbricks/types/webhooks";
import { ModalWithTabs } from "@formbricks/ui/components/ModalWithTabs";

interface WebhookModalProps {
  open: boolean;
  setOpen: (v: boolean) => void;
  webhook: TWebhook;
  surveys: TSurvey[];
}

export const WebhookModal = ({ open, setOpen, webhook, surveys }: WebhookModalProps) => {
  const t = useTranslations();
  const tabs = [
    {
      title: t("common.overview"),
      children: <WebhookOverviewTab webhook={webhook} surveys={surveys} />,
    },
    {
      title: t("common.settings"),
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
