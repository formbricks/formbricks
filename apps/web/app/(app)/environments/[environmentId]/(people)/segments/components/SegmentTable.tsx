import { TActionClass } from "@formbricks/types/actionClasses";
import { TAttributeClass } from "@formbricks/types/attributeClasses";
import { TSegment } from "@formbricks/types/segment";

import SegmentTableDataRowContainer from "./SegmentTableDataRowContainer";

type TSegmentTableProps = {
  segments: TSegment[];
  attributeClasses: TAttributeClass[];
  actionClasses: TActionClass[];
  isAdvancedTargetingAllowed: boolean;
};
const SegmentTable = ({
  segments,
  actionClasses,
  attributeClasses,
  isAdvancedTargetingAllowed,
}: TSegmentTableProps) => {
  return (
    <div className="rounded-lg border border-slate-200">
      <div className="grid h-12 grid-cols-7 content-center rounded-lg bg-slate-100 text-left text-sm font-semibold text-slate-900">
        <div className="col-span-4 pl-6">Title</div>
        <div className="col-span-1 hidden text-center sm:block">Surveys</div>
        <div className="col-span-1 hidden text-center sm:block">Updated</div>
        <div className="col-span-1 hidden text-center sm:block">Created</div>
      </div>
      {segments.map((segment) => (
        <SegmentTableDataRowContainer
          currentSegment={segment}
          segments={segments}
          actionClasses={actionClasses}
          attributeClasses={attributeClasses}
          isAdvancedTargetingAllowed={isAdvancedTargetingAllowed}
        />
      ))}
    </div>
  );
};

export default SegmentTable;
