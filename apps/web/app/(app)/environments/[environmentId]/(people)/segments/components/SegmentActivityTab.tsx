"use client";

import { Label } from "@/modules/ui/components/label";
import { useTranslations } from "next-intl";
import { convertDateTimeStringShort } from "@formbricks/lib/time";
import { TSegment } from "@formbricks/types/segment";

interface SegmentActivityTabProps {
  environmentId: string;
  currentSegment: TSegment & {
    activeSurveys: string[];
    inactiveSurveys: string[];
  };
}

export const SegmentActivityTab = ({ currentSegment }: SegmentActivityTabProps) => {
  const t = useTranslations();
  const activeSurveys = currentSegment?.activeSurveys;
  const inactiveSurveys = currentSegment?.inactiveSurveys;

  return (
    <div className="grid grid-cols-3 pb-2">
      <div className="col-span-2 space-y-4 pr-6">
        <div>
          <Label className="text-slate-500">{t("common.active_surveys")}</Label>
          {!activeSurveys?.length && <p className="text-sm text-slate-900">-</p>}

          {activeSurveys?.map((survey) => <p className="text-sm text-slate-900">{survey}</p>)}
        </div>
        <div>
          <Label className="text-slate-500">{t("common.inactive_surveys")}</Label>
          {!inactiveSurveys?.length && <p className="text-sm text-slate-900">-</p>}

          {inactiveSurveys?.map((survey) => <p className="text-sm text-slate-900">{survey}</p>)}
        </div>
      </div>
      <div className="col-span-1 space-y-3 rounded-lg border border-slate-100 bg-slate-50 p-2">
        <div>
          <Label className="text-xs font-normal text-slate-500">{t("common.created_at")}</Label>
          <p className="text-xs text-slate-700">
            {convertDateTimeStringShort(currentSegment.createdAt?.toString())}
          </p>
        </div>{" "}
        <div>
          <Label className="text-xs font-normal text-slate-500">{t("common.updated_at")}</Label>
          <p className="text-xs text-slate-700">
            {convertDateTimeStringShort(currentSegment.updatedAt?.toString())}
          </p>
        </div>
      </div>
    </div>
  );
};
