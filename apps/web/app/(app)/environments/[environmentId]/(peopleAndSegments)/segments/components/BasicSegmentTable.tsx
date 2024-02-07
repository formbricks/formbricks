import BasicSegmentTableDataRowContainer from "@/app/(app)/environments/[environmentId]/(peopleAndSegments)/segments/components/BasicSegmentTableDataRowContainer";

import { TAttributeClass } from "@formbricks/types/attributeClasses";
import { TSegment } from "@formbricks/types/segment";

type TSegmentTableProps = {
  segments: TSegment[];
  attributeClasses: TAttributeClass[];
};
const BasicSegmentTable = async ({ segments, attributeClasses }: TSegmentTableProps) => {
  return (
    <div className="rounded-lg border border-slate-200">
      <div className="grid h-12 grid-cols-7 content-center rounded-lg bg-slate-100 text-left text-sm font-semibold text-slate-900">
        <div className="col-span-4 pl-6">Title</div>
        <div className="col-span-1 hidden text-center sm:block">Live Studies</div>
        <div className="col-span-1 hidden text-center sm:block">Updated</div>
        <div className="col-span-1 hidden text-center sm:block">Created</div>
      </div>
      {segments.map((segment) => (
        <BasicSegmentTableDataRowContainer currentSegment={segment} attributeClasses={attributeClasses} />
      ))}
    </div>
  );
};

export default BasicSegmentTable;
