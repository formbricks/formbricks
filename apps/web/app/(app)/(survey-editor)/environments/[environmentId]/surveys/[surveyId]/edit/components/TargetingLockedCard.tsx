import { UpgradePrompt } from "@/modules/ui/components/upgrade-prompt";
import * as Collapsible from "@radix-ui/react-collapsible";
import { LockIcon, UsersIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";

export const TargetingLockedCard = () => {
  const t = useTranslations();
  const [open, setOpen] = useState(false);

  return (
    <Collapsible.Root
      className="w-full overflow-hidden rounded-lg border border-slate-300 bg-white"
      onOpenChange={setOpen}
      open={open}>
      <Collapsible.CollapsibleTrigger
        asChild
        className="h-full w-full cursor-pointer rounded-lg hover:bg-slate-50">
        <div className="inline-flex px-4 py-6">
          <div className="flex items-center pl-2 pr-5">
            <div className="rounded-full border border-slate-300 bg-slate-100 p-1">
              <LockIcon className="h-4 w-4 text-slate-500" strokeWidth={3} />
            </div>
          </div>
          <div>
            <p className="font-semibold text-slate-800">{t("environments.segments.target_audience")}</p>
            <p className="mt-1 text-sm text-slate-500">{t("environments.segments.pre_segment_users")}</p>
          </div>
        </div>
      </Collapsible.CollapsibleTrigger>
      <Collapsible.CollapsibleContent className="min-w-full overflow-auto">
        <hr className="text-slate-600" />
        <div className="flex items-center justify-center">
          <UpgradePrompt
            icon={<UsersIcon className="h-6 w-6 text-slate-900" />}
            title={t("environments.surveys.edit.unlock_targeting_title")}
            description={t("environments.surveys.edit.unlock_targeting_description")}
            buttons={[
              {
                text: t("common.start_free_trial"),
                href: `https://formbricks.com/docs/self-hosting/license#30-day-trial-license-request`,
              },
              {
                text: t("common.learn_more"),
                href: `https://formbricks.com/docs/self-hosting/license#30-day-trial-license-request`,
              },
            ]}
          />
        </div>
      </Collapsible.CollapsibleContent>
    </Collapsible.Root>
  );
};
