import { useTranslation } from "react-i18next";
import { TResponseWithQuotas } from "@formbricks/types/responses";
import { ResponseBadges } from "@/modules/ui/components/response-badges";

interface ResponseCardQuotasProps {
  quotas: TResponseWithQuotas["quotas"];
}

export const ResponseCardQuotas = ({ quotas }: ResponseCardQuotasProps) => {
  const { t } = useTranslation();

  if (!quotas || quotas.length === 0) return null;

  return (
    <div data-testid="main-quotas-div" className="mt-6 flex flex-col gap-1">
      <p className="text-sm text-slate-500">{t("common.quotas")}</p>
      <div className="flex flex-wrap gap-2">
        {quotas.map((quota) => (
          <ResponseBadges key={quota.id} items={[{ value: quota.name }]} showId={false} />
        ))}
      </div>
    </div>
  );
};
