"use client";

import { Label } from "@formbricks/ui";
import { TUserSegment } from "@formbricks/types/v1/userSegment";
import LoadingSpinner from "@/components/shared/LoadingSpinner";
import { convertDateTimeStringShort } from "@formbricks/lib/time";
import { useUserSegment } from "@/lib/userSegments/userSegments";

interface SegmentActivityTabProps {
  environmentId: string;
  segment: TUserSegment;
}

export default function SegmentActivityTab({ environmentId, segment }: SegmentActivityTabProps) {
  const { userSegment, isLoadingUserSegment } = useUserSegment(environmentId, segment.id);

  if (isLoadingUserSegment) {
    return <LoadingSpinner />;
  }

  const activeSurveys = userSegment?.activeSurveys;
  const inactiveSurveys = userSegment?.inactiveSurveys;

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
            {convertDateTimeStringShort(segment.createdAt?.toString())}
          </p>
        </div>{" "}
        <div>
          <Label className="text-xs font-normal text-slate-500">Last updated</Label>
          <p className=" text-xs text-slate-700">
            {convertDateTimeStringShort(segment.updatedAt?.toString())}
          </p>
        </div>
      </div>
    </div>
  );
}
