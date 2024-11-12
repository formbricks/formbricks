"use client";

import { type JSX, useState } from "react";
import { TActionClass } from "@formbricks/types/action-classes";
import { ActionDetailModal } from "./ActionDetailModal";

interface ActionClassesTableProps {
  environmentId: string;
  actionClasses: TActionClass[];
  children: [JSX.Element, JSX.Element[]];
  isReadOnly: boolean;
}

export const ActionClassesTable = ({
  environmentId,
  actionClasses,
  children: [TableHeading, actionRows],
  isReadOnly,
}: ActionClassesTableProps) => {
  const [isActionDetailModalOpen, setActionDetailModalOpen] = useState(false);

  const [activeActionClass, setActiveActionClass] = useState<TActionClass>();

  const handleOpenActionDetailModalClick = (e, actionClass: TActionClass) => {
    e.preventDefault();
    setActiveActionClass(actionClass);
    setActionDetailModalOpen(true);
  };

  return (
    <>
      <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
        {TableHeading}
        <div id="actionClassesWrapper" className="flex flex-col">
          {actionClasses.map((actionClass, index) => (
            <button
              onClick={(e) => {
                handleOpenActionDetailModalClick(e, actionClass);
              }}
              className="w-full"
              title={actionClass.name}
              key={actionClass.id}>
              {actionRows[index]}
            </button>
          ))}
        </div>
      </div>
      {activeActionClass && (
        <ActionDetailModal
          environmentId={environmentId}
          open={isActionDetailModalOpen}
          setOpen={setActionDetailModalOpen}
          actionClasses={actionClasses}
          actionClass={activeActionClass}
          isReadOnly={isReadOnly}
        />
      )}
    </>
  );
};
