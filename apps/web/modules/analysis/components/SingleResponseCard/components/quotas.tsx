import { ResponseBadges } from "@/modules/ui/components/response-badges";
import { useTranslate } from "@tolgee/react";
import { TSurveyQuota } from "@formbricks/types/quota";

interface QuotasProps {
  quotas: TSurveyQuota[];
}

export const Quotas = ({ quotas }: QuotasProps) => {
  const { t } = useTranslate();

  return (
    <div data-testid="main-hidden-fields-div" className="mt-6 flex flex-col gap-1">
      <p className="text-sm text-slate-500">{t("common.quotas")}</p>
      <div className="flex flex-wrap gap-2">
        {quotas.map((quota) => (
          <ResponseBadges items={[{ value: quota.name }]} showId={false} />
        ))}
      </div>
    </div>
  );
};
