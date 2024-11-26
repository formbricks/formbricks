"use client";

import { useMemo, useState } from "react";
import { TAttributeClass } from "@formbricks/types/attribute-classes";
import { Switch } from "@formbricks/ui/Switch";
import { AttributeDetailModal } from "./AttributeDetailModal";
import { AttributeClassDataRow } from "./AttributeRowData";
import { AttributeTableHeading } from "./AttributeTableHeading";
import { UploadAttributesModal } from "./UploadAttributesModal";

interface AttributeClassesTableProps {
  attributeClasses: TAttributeClass[];
}

export const AttributeClassesTable = ({ attributeClasses }: AttributeClassesTableProps) => {
  const [isAttributeDetailModalOpen, setAttributeDetailModalOpen] = useState(false);
  const [isUploadCSVModalOpen, setUploadCSVModalOpen] = useState(false);
  const [activeAttributeClass, setActiveAttributeClass] = useState<TAttributeClass | null>(null);
  const [showArchived, setShowArchived] = useState(false);

  const displayedAttributeClasses = useMemo(() => {
    return attributeClasses
      ? showArchived
        ? attributeClasses
        : attributeClasses.filter((ac) => !ac.archived)
      : [];
  }, [showArchived, attributeClasses]);

  const hasArchived = useMemo(() => {
    return attributeClasses ? attributeClasses.some((ac) => ac.archived) : false;
  }, [attributeClasses]);

  const handleOpenAttributeDetailModalClick = (attributeClass: TAttributeClass) => {
    setActiveAttributeClass(attributeClass);
    setAttributeDetailModalOpen(true);
  };

  const toggleShowArchived = () => {
    setShowArchived(!showArchived);
  };

  return (
    <>
      {hasArchived && (
        <div className="my-4 flex items-center justify-end text-right">
          <div className="flex items-center text-sm font-medium">
            Show archived
            <Switch className="mx-3" checked={showArchived} onCheckedChange={toggleShowArchived} />
          </div>
        </div>
      )}
      <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
        <AttributeTableHeading />
        <div className="grid-cols-7">
          {displayedAttributeClasses.map((attributeClass, index) => (
            <button
              onClick={() => handleOpenAttributeDetailModalClick(attributeClass)}
              className="w-full cursor-default"
              key={attributeClass.id}>
              <AttributeClassDataRow attributeClass={attributeClass} key={index} />
            </button>
          ))}
        </div>
        {activeAttributeClass && (
          <AttributeDetailModal
            open={isAttributeDetailModalOpen}
            setOpen={setAttributeDetailModalOpen}
            attributeClass={activeAttributeClass}
          />
        )}

        <UploadAttributesModal open={isUploadCSVModalOpen} setOpen={setUploadCSVModalOpen} />
      </div>
    </>
  );
};
