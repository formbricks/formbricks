"use client";

import { UsersIcon } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { TContactAttributeKey } from "@formbricks/types/contact-attribute-key";
import { TSegment, TSegmentWithSurveyNames } from "@formbricks/types/segment";
import { timeSinceDate } from "@/lib/time";
import { formatDateForDisplay } from "@/lib/utils/datetime";
import { EditSegmentModal } from "./edit-segment-modal";

type TSegmentTableDataRowProps = {
  currentSegment: TSegmentWithSurveyNames;
  segments: TSegment[];
  contactAttributeKeys: TContactAttributeKey[];
  isContactsEnabled: boolean;
  isReadOnly: boolean;
};

export const SegmentTableDataRow = ({
  currentSegment,
  contactAttributeKeys,
  segments,
  isContactsEnabled,
  isReadOnly,
}: TSegmentTableDataRowProps) => {
  const { createdAt, environmentId, id, surveys, title, updatedAt, description } = currentSegment;
  const [isEditSegmentModalOpen, setIsEditSegmentModalOpen] = useState(false);
  const { i18n } = useTranslation();
  const locale = i18n.resolvedLanguage ?? i18n.language ?? "en-US";

  return (
    <>
      <button
        key={id}
        className="grid h-12 w-full cursor-pointer grid-cols-7 content-center p-2 text-left transition-colors ease-in-out hover:bg-slate-100"
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
          <div className="ph-no-capture text-slate-900">{timeSinceDate(updatedAt, locale)}</div>
        </div>
        <div className="col-span-1 my-auto hidden whitespace-normal text-center text-sm text-slate-500 sm:block">
          <div className="ph-no-capture text-slate-900">
            {formatDateForDisplay(createdAt, locale, {
              year: "numeric",
              month: "long",
              day: "numeric",
            })}
          </div>
        </div>
      </button>

      <EditSegmentModal
        environmentId={environmentId}
        open={isEditSegmentModalOpen}
        setOpen={setIsEditSegmentModalOpen}
        currentSegment={currentSegment}
        contactAttributeKeys={contactAttributeKeys}
        segments={segments}
        isContactsEnabled={isContactsEnabled}
        isReadOnly={isReadOnly}
      />
    </>
  );
};
