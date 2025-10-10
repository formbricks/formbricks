"use client";

import { CopyIcon, Trash2Icon } from "lucide-react";
import { useTranslation } from "react-i18next";
import { TSurveyQuota } from "@formbricks/types/quota";
import { Button } from "@/modules/ui/components/button";
import { Label } from "@/modules/ui/components/label";
import { TooltipRenderer } from "@/modules/ui/components/tooltip";

interface QuotaListProps {
  quotas: TSurveyQuota[];
  onEdit: (quota: TSurveyQuota) => void;
  deleteQuota: (quota: TSurveyQuota) => void;
  duplicateQuota: (quota: TSurveyQuota) => void;
}

export const QuotaList = ({ quotas, onEdit, deleteQuota, duplicateQuota }: QuotaListProps) => {
  const { t } = useTranslation();

  return (
    <div className="space-y-3">
      {quotas.map((quota) => (
        // Using div instead of button to avoid nested button HTML validation errors
        // eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions, jsx-a11y/prefer-tag-over-role
        <div
          key={quota.id}
          className="flex w-full cursor-pointer items-center justify-between rounded-lg bg-slate-50 p-4 transition-colors hover:bg-slate-100"
          onClick={() => onEdit(quota)}
          role="button"
          tabIndex={0}>
          <div className="text-left">
            <Label className="text-sm font-medium text-slate-800">{quota.name}</Label>
            <div className="mt-1 text-sm text-slate-500">
              {t("environments.surveys.edit.quotas.limited_to_x_responses", {
                limit: quota.limit.toLocaleString(),
              })}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <TooltipRenderer tooltipContent={t("common.delete")}>
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
            </TooltipRenderer>
            <TooltipRenderer tooltipContent={t("common.duplicate")}>
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
            </TooltipRenderer>
          </div>
        </div>
      ))}
    </div>
  );
};
