"use client";

import { Switch } from "@formbricks/ui";
import { useState } from "react";
import AttributeDetailModal from "./AttributeDetailModal";
import UploadAttributesModal from "./UploadAttributesModal";
import { useMemo } from "react";
import { TAttributeClass } from "@formbricks/types/v1/attributeClasses";

export default function AttributeClassesTable({
  attributeClasses,
  children: [TableHeading, howToAddAttributeButton, attributeRows],
}: {
  attributeClasses: TAttributeClass[];
  children: [JSX.Element, JSX.Element, JSX.Element[]];
}) {
  const [isAttributeDetailModalOpen, setAttributeDetailModalOpen] = useState(false);
  const [isUploadCSVModalOpen, setUploadCSVModalOpen] = useState(false);
  const [activeAttributeClass, setActiveAttributeClass] = useState("" as any);
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

  const handleOpenAttributeDetailModalClick = (e, attributeClass) => {
    e.preventDefault();
    setActiveAttributeClass(attributeClass);
    setAttributeDetailModalOpen(true);
  };

  const toggleShowArchived = () => {
    setShowArchived(!showArchived);
  };

  return (
    <>
      <div className="mb-6 flex items-center justify-end text-right">
        {hasArchived && (
          <div className="flex items-center text-sm font-medium">
            Show archived
            <Switch className="mx-3" checked={showArchived} onCheckedChange={toggleShowArchived} />
          </div>
        )}
        {howToAddAttributeButton}
      </div>
      <div className="rounded-lg border border-slate-200">
        {TableHeading}
        <div className="grid-cols-7">
          {displayedAttributeClasses.map((attributeClass, index) => (
            <button
              onClick={(e) => {
                handleOpenAttributeDetailModalClick(e, attributeClass);
              }}
              className="w-full"
              key={attributeClass.id}>
              {attributeRows[index]}
            </button>
          ))}
        </div>
        <AttributeDetailModal
          open={isAttributeDetailModalOpen}
          setOpen={setAttributeDetailModalOpen}
          attributeClass={activeAttributeClass}
        />
        <UploadAttributesModal open={isUploadCSVModalOpen} setOpen={setUploadCSVModalOpen} />
      </div>
    </>
  );
}
