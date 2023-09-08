"use client";

import { Label } from "@formbricks/ui";
import { TUserSegment } from "@formbricks/types/v1/userSegment";
import { convertDateTimeStringShort } from "@formbricks/lib/time";

interface SegmentActivityTabProps {
  environmentId: string;
  currentSegment: TUserSegment & {
    activeSurveys: string[];
    inactiveSurveys: string[];
  };
}

export default function SegmentActivityTab({ currentSegment }: SegmentActivityTabProps) {
  const activeSurveys = currentSegment?.activeSurveys;
  const inactiveSurveys = currentSegment?.inactiveSurveys;

  return (
    <div className="grid grid-cols-3 pb-2">
      <div className="col-span-2 space-y-4 pr-6">
        <div>
          <Label className="text-slate-500">Active surveys</Label>
          {!activeSurveys?.length && <p className="text-sm text-slate-900">-</p>}

          {activeSurveys?.map((survey) => (
            <p className="text-sm text-slate-900">{survey}</p>
          ))}
        </div>
        <div>
          <Label className="text-slate-500">Inactive surveys</Label>
          {!inactiveSurveys?.length && <p className="text-sm text-slate-900">-</p>}

          {inactiveSurveys?.map((survey) => (
            <p className="text-sm text-slate-900">{survey}</p>
          ))}
        </div>
      </div>
      <div className="col-span-1 space-y-3 rounded-lg border border-slate-100 bg-slate-50 p-2">
        <div>
          <Label className="text-xs font-normal text-slate-500">Created on</Label>
          <p className=" text-xs text-slate-700">
            {convertDateTimeStringShort(currentSegment.createdAt?.toString())}
          </p>
        </div>{" "}
        <div>
          <Label className="text-xs font-normal text-slate-500">Last updated</Label>
          <p className=" text-xs text-slate-700">
            {convertDateTimeStringShort(currentSegment.updatedAt?.toString())}
          </p>
        </div>
      </div>
    </div>
  );
}
