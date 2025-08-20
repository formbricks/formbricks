"use client";

import { createQuotaAction } from "@/modules/ee/quotas/actions";
import { Button } from "@/modules/ui/components/button";
import { Label } from "@radix-ui/react-dropdown-menu";
import { useTranslate } from "@tolgee/react";
import { CopyIcon, Trash2Icon } from "lucide-react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { TSurveyQuota } from "@formbricks/types/quota";

interface QuotaListProps {
  quotas: TSurveyQuota[];
  onEdit: (quota: TSurveyQuota) => void;
  deleteQuota: (quota: TSurveyQuota) => void;
}

export const QuotaList = ({ quotas, onEdit, deleteQuota }: QuotaListProps) => {
  const router = useRouter();
  const { t } = useTranslate();

  const duplicateQuota = async (quota: TSurveyQuota) => {
    const duplicateQuota = {
      ...quota,
      name: `${quota.name} (Copy)`,
    };
    const duplicateQuotaActionResult = await createQuotaAction({
      quota: duplicateQuota,
    });
    if (duplicateQuotaActionResult?.data) {
      toast.success(t("environments.surveys.edit.quotas.quota_duplicated_successfull_toast"));
      router.refresh();
    } else {
      toast.error(t("environments.surveys.edit.quotas.failed_to_duplicate_quota_toast"));
    }
  };

  return (
    <div className="space-y-3">
      {quotas.map((quota) => (
        <div
          role="button"
          tabIndex={0}
          key={quota.id}
          className="flex cursor-pointer items-center justify-between rounded-lg bg-slate-50 p-4 transition-colors"
          onClick={() => onEdit(quota)}>
          <div className="flex-1">
            <Label className="text-sm font-medium text-slate-800">{quota.name}</Label>
            <div className="mt-1 text-sm text-slate-500">
              {t("environments.surveys.edit.quotas.limited_to_x_responses", {
                limit: quota.limit.toLocaleString(),
              })}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                duplicateQuota(quota);
              }}
              className="h-8 w-8 p-0 text-slate-500">
              <CopyIcon className="h-4 w-4" />
            </Button>

            <Button
              variant="ghost"
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                deleteQuota(quota);
              }}
              className="h-8 w-8 p-0 text-slate-500">
              <Trash2Icon className="h-4 w-4" />
            </Button>
          </div>
        </div>
      ))}
    </div>
  );
};
