"use client";

import { SlackIcon } from "@/modules/ui/components/icons";
import { useTranslate } from "@tolgee/react";

interface IntegrationsTipProps {
  environmentId: string;
}

export const IntegrationsTip = ({ environmentId }: IntegrationsTipProps) => {
  const { t } = useTranslate();
  return (
    <div>
      <div className="flex max-w-4xl items-center space-y-3 rounded-lg border border-blue-100 bg-blue-50 p-4 text-sm text-blue-900 shadow-sm md:space-y-0 md:text-base">
        <SlackIcon className="mr-3 h-4 w-4 text-blue-400" />
        <p className="text-sm">
          {t("environments.settings.notifications.need_slack_or_discord_notifications")}?
          <a
            href={`/environments/${environmentId}/integrations`}
            className="ml-1 cursor-pointer text-sm underline">
            {t("environments.settings.notifications.use_the_integration")}
          </a>
        </p>
      </div>
    </div>
  );
};
