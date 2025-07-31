"use client";

import { type JSX, useState } from "react";
import { TActionClass } from "@formbricks/types/action-classes";
import { TEnvironment } from "@formbricks/types/environment";
import { ActionDetailModal } from "./ActionDetailModal";

interface ActionClassesTableProps {
  environmentId: string;
  actionClasses: TActionClass[];
  environment: TEnvironment;
  children: [JSX.Element, JSX.Element[]];
  isReadOnly: boolean;
  otherEnvironment: TEnvironment;
  otherEnvActionClasses: TActionClass[];
}

export const ActionClassesTable = ({
  environmentId,
  actionClasses,
  environment,
  children: [TableHeading, actionRows],
  isReadOnly,
  otherEnvActionClasses,
  otherEnvironment,
}: ActionClassesTableProps) => {
  const [isActionDetailModalOpen, setIsActionDetailModalOpen] = useState(false);

  const [activeActionClass, setActiveActionClass] = useState<TActionClass>();

  const handleOpenActionDetailModalClick = (
    e: React.MouseEvent<HTMLButtonElement>,
    actionClass: TActionClass
  ) => {
    e.preventDefault();
    setActiveActionClass(actionClass);
    setIsActionDetailModalOpen(true);
  };

  return (
    <>
      <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
        {TableHeading}
        <div id="actionClassesWrapper" className="flex flex-col">
          {actionClasses.length > 0 ? (
            actionClasses.map((actionClass, index) => (
              <button
                onClick={(e: React.MouseEvent<HTMLButtonElement>) => {
                  handleOpenActionDetailModalClick(e, actionClass);
                }}
                className="w-full"
                title={actionClass.name}
                key={actionClass.id}>
                {actionRows[index]}
              </button>
            ))
          ) : (
            <div className="py-8 text-center">
              <span className="text-sm text-slate-500">No actions found</span>
            </div>
          )}
        </div>
      </div>
      {activeActionClass && (
        <ActionDetailModal
          environmentId={environmentId}
          environment={environment}
          open={isActionDetailModalOpen}
          setOpen={setIsActionDetailModalOpen}
          actionClasses={actionClasses}
          actionClass={activeActionClass}
          isReadOnly={isReadOnly}
          otherEnvActionClasses={otherEnvActionClasses}
          otherEnvironment={otherEnvironment}
        />
      )}
    </>
  );
};
