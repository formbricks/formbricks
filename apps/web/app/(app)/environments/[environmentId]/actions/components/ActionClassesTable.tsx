"use client";

import { useState } from "react";
import { useMembershipRole } from "@formbricks/lib/membership/hooks/useMembershipRole";
import { TActionClass } from "@formbricks/types/action-classes";
import { ErrorComponent } from "@formbricks/ui/ErrorComponent";
import { ActionDetailModal } from "./ActionDetailModal";

interface ActionClassesTableProps {
  environmentId: string;
  actionClasses: TActionClass[];
  children: [JSX.Element, JSX.Element[]];
}

export const ActionClassesTable = ({
  environmentId,
  actionClasses,
  children: [TableHeading, actionRows],
}: ActionClassesTableProps) => {
  const [isActionDetailModalOpen, setActionDetailModalOpen] = useState(false);
  const { membershipRole, error } = useMembershipRole(environmentId);

  const [activeActionClass, setActiveActionClass] = useState<TActionClass>();

  const handleOpenActionDetailModalClick = (e, actionClass: TActionClass) => {
    e.preventDefault();
    setActiveActionClass(actionClass);
    setActionDetailModalOpen(true);
  };

  if (error) {
    return <ErrorComponent />;
  }
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
          membershipRole={membershipRole}
        />
      )}
    </>
  );
};
