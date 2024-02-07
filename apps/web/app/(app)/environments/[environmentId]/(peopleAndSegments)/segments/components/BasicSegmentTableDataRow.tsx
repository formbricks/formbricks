"use client";

import BasicEditSegmentModal from "@/app/(app)/environments/[environmentId]/(peopleAndSegments)/segments/components/BasicEditSegmentModal";
import { UserGroupIcon } from "@heroicons/react/24/solid";
import { format, formatDistanceToNow } from "date-fns";
import { useState } from "react";

import { TAttributeClass } from "@formbricks/types/attributeClasses";
import { TSegment } from "@formbricks/types/segment";

type TSegmentTableDataRowProps = {
  currentSegment: TSegment & {
    activeSurveys: string[];
    inactiveSurveys: string[];
  };
  attributeClasses: TAttributeClass[];
};

const BasicSegmentTableDataRow = ({ currentSegment, attributeClasses }: TSegmentTableDataRowProps) => {
  const { createdAt, environmentId, id, surveys, title, updatedAt, description } = currentSegment;
  const [isEditSegmentModalOpen, setIsEditSegmentModalOpen] = useState(false);

  return (
    <>
      <BasicEditSegmentModal
        environmentId={environmentId}
        open={isEditSegmentModalOpen}
        setOpen={setIsEditSegmentModalOpen}
        currentSegment={currentSegment}
        attributeClasses={attributeClasses}
      />
      <div
        key={id}
        className="m-2 grid h-16 cursor-pointer grid-cols-7 content-center rounded-lg hover:bg-slate-100"
        onClick={() => setIsEditSegmentModalOpen(true)}>
        <div className="col-span-4 flex items-center pl-6 text-sm">
          <div className="flex items-center gap-4">
            <div className="ph-no-capture h-8 w-8 flex-shrink-0 text-slate-700">
              <UserGroupIcon />
            </div>
            <div className="flex flex-col">
              <div className="ph-no-capture font-medium text-slate-900">{title}</div>
              <div className="ph-no-capture text-xs font-medium text-slate-500">{description}</div>
            </div>
          </div>
        </div>
        <div className="col-span-1 my-auto hidden whitespace-nowrap text-center text-sm text-slate-500 sm:block">
          <div className="ph-no-capture text-slate-900">{surveys?.length}</div>
        </div>
        <div className="col-span-1 my-auto hidden whitespace-nowrap text-center text-sm text-slate-500 sm:block">
          <div className="ph-no-capture text-slate-900">
            {formatDistanceToNow(updatedAt, {
              addSuffix: true,
            }).replace("about", "")}
          </div>
        </div>
        <div className="col-span-1 my-auto hidden whitespace-nowrap text-center text-sm text-slate-500 sm:block">
          <div className="ph-no-capture text-slate-900">{format(createdAt, "do 'of' MMMM, yyyy")}</div>
        </div>
      </div>
    </>
  );
};

export default BasicSegmentTableDataRow;
