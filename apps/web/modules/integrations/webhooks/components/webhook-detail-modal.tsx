import { WebhookOverviewTab } from "@/modules/integrations/webhooks/components/webhook-overview-tab";
import { WebhookSettingsTab } from "@/modules/integrations/webhooks/components/webhook-settings-tab";
import { ModalWithTabs } from "@/modules/ui/components/modal-with-tabs";
import { Webhook } from "@prisma/client";
import { WebhookIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { TSurvey } from "@formbricks/types/surveys/types";

interface WebhookModalProps {
  open: boolean;
  setOpen: (v: boolean) => void;
  webhook: Webhook;
  surveys: TSurvey[];
  isReadOnly: boolean;
}

export const WebhookModal = ({ open, setOpen, webhook, surveys, isReadOnly }: WebhookModalProps) => {
  const t = useTranslations();
  const tabs = [
    {
      title: t("common.overview"),
      children: <WebhookOverviewTab webhook={webhook} surveys={surveys} />,
    },
    {
      title: t("common.settings"),
      children: (
        <WebhookSettingsTab webhook={webhook} surveys={surveys} setOpen={setOpen} isReadOnly={isReadOnly} />
      ),
    },
  ];

  return (
    <>
      <ModalWithTabs
        open={open}
        setOpen={setOpen}
        tabs={tabs}
        icon={<WebhookIcon />}
        label={webhook.name ? webhook.name : webhook.url}
        description={""}
      />
    </>
  );
};
