import SegmentTableDataRow from "@/app/(app)/environments/[environmentId]/(peopleAndSegments)/segments/SegmentTableDataRow";
import { TUserSegment } from "@formbricks/types/v1/userSegment";
import React from "react";

type TSegmentTableProps = {
  segments: TUserSegment[];
};
const SegmentTable = ({ segments }: TSegmentTableProps) => {
  return (
    <div className="rounded-lg border border-slate-200">
      <div className="grid h-12 grid-cols-7 content-center rounded-lg bg-slate-100 text-left text-sm font-semibold text-slate-900">
        <div className="col-span-4 pl-6">Title</div>
        <div className="col-span-1 hidden text-center sm:block">Live Studies</div>
        <div className="col-span-1 hidden text-center sm:block">Updated</div>
        <div className="col-span-1 hidden text-center sm:block">Created</div>
      </div>
      {segments.map((segment) => (
        <SegmentTableDataRow key={segment.id} segment={segment} />
      ))}
    </div>
  );
};

export default SegmentTable;
