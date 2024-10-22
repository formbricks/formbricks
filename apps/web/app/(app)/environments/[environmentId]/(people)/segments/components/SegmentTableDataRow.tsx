"use client";

import { format, formatDistanceToNow } from "date-fns";
import { UsersIcon } from "lucide-react";
import { useState } from "react";
import { TAttributeClass } from "@formbricks/types/attribute-classes";
import { TSegment, TSegmentWithSurveyNames } from "@formbricks/types/segment";
import { EditSegmentModal } from "./EditSegmentModal";

type TSegmentTableDataRowProps = {
  currentSegment: TSegmentWithSurveyNames;
  segments: TSegment[];
  attributeClasses: TAttributeClass[];
  isAdvancedTargetingAllowed: boolean;
  isFormbricksCloud: boolean;
};

export const SegmentTableDataRow = ({
  currentSegment,
  attributeClasses,
  segments,
  isAdvancedTargetingAllowed,
  isFormbricksCloud,
}: TSegmentTableDataRowProps) => {
  const { createdAt, environmentId, id, surveys, title, updatedAt, description } = currentSegment;
  const [isEditSegmentModalOpen, setIsEditSegmentModalOpen] = useState(false);

  return (
    <>
      <div
        key={id}
        className="m-2 grid h-16 cursor-pointer grid-cols-7 content-center rounded-lg transition-colors ease-in-out hover:bg-slate-100"
        onClick={() => setIsEditSegmentModalOpen(true)}>
        <div className="col-span-4 flex items-center pl-6 text-sm">
          <div className="flex items-center gap-4">
            <div className="ph-no-capture w-8 flex-shrink-0 text-slate-500">
              <UsersIcon className="h-5 w-5" />
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
        <div className="whitespace-wrap col-span-1 my-auto hidden text-center text-sm text-slate-500 sm:block">
          <div className="ph-no-capture text-slate-900">
            {formatDistanceToNow(updatedAt, {
              addSuffix: true,
            }).replace("about", "")}
          </div>
        </div>
        <div className="col-span-1 my-auto hidden whitespace-normal text-center text-sm text-slate-500 sm:block">
          <div className="ph-no-capture text-slate-900">{format(createdAt, "do 'of' MMMM, yyyy")}</div>
        </div>
      </div>

      <EditSegmentModal
        environmentId={environmentId}
        open={isEditSegmentModalOpen}
        setOpen={setIsEditSegmentModalOpen}
        currentSegment={currentSegment}
        attributeClasses={attributeClasses}
        segments={segments}
        isAdvancedTargetingAllowed={isAdvancedTargetingAllowed}
        isFormbricksCloud={isFormbricksCloud}
      />
    </>
  );
};
