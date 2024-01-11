import SegmentTableDataRowContainer from "@/app/(app)/environments/[environmentId]/(peopleAndSegments)/segments/SegmentTableDataRowContainer";
import React from "react";

import { TActionClass } from "@formbricks/types/actionClasses";
import { TAttributeClass } from "@formbricks/types/attributeClasses";
import { TUserSegment } from "@formbricks/types/userSegment";

type TSegmentTableProps = {
  userSegments: TUserSegment[];
  attributeClasses: TAttributeClass[];
  actionClasses: TActionClass[];
};
const SegmentTable = ({ userSegments, actionClasses, attributeClasses }: TSegmentTableProps) => {
  return (
    <div className="rounded-lg border border-slate-200">
      <div className="grid h-12 grid-cols-7 content-center rounded-lg bg-slate-100 text-left text-sm font-semibold text-slate-900">
        <div className="col-span-4 pl-6">Title</div>
        <div className="col-span-1 hidden text-center sm:block">Live Studies</div>
        <div className="col-span-1 hidden text-center sm:block">Updated</div>
        <div className="col-span-1 hidden text-center sm:block">Created</div>
      </div>
      {userSegments.map((segment) => (
        <SegmentTableDataRowContainer
          currentSegment={segment}
          userSegments={userSegments}
          actionClasses={actionClasses}
          attributeClasses={attributeClasses}
        />
      ))}
    </div>
  );
};

export default SegmentTable;
