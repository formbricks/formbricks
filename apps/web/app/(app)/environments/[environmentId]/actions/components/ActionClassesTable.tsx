"use client";

import { PlusIcon } from "lucide-react";
import { useState } from "react";

import { useMembershipRole } from "@formbricks/lib/membership/hooks/useMembershipRole";
import { getAccessFlags } from "@formbricks/lib/membership/utils";
import { TActionClass } from "@formbricks/types/actionClasses";
import { ErrorComponent } from "@formbricks/ui/ErrorComponent";

import ActionDetailModal from "./ActionDetailModal";
import AddNoCodeActionModal from "./AddActionModal";

interface ActionClassesTableProps {
  environmentId: string;
  actionClasses: TActionClass[];
  children: [JSX.Element, JSX.Element[]];
  isUserTargetingEnabled: boolean;
}

export default function ActionClassesTable({
  environmentId,
  actionClasses,
  children: [TableHeading, actionRows],
  isUserTargetingEnabled,
}: ActionClassesTableProps) {
  const [isActionDetailModalOpen, setActionDetailModalOpen] = useState(false);
  const [isAddActionModalOpen, setAddActionModalOpen] = useState(false);
  const { membershipRole, isLoading, error } = useMembershipRole(environmentId);
  const { isViewer } = getAccessFlags(membershipRole);

  const [activeActionClass, setActiveActionClass] = useState<TActionClass>({
    environmentId,
    id: "",
    name: "",
    type: "noCode",
    key: "",
    description: "",
    noCodeConfig: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  });

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
          {!isViewer && (
            <button
              onClick={() => {
                setAddActionModalOpen(true);
              }}
              disabled={isLoading}
              className="m-2 flex-1 content-center rounded-lg border border-slate-300 bg-slate-100 py-3 transition-colors ease-in-out hover:border-slate-500 hover:bg-slate-200">
              <div className="col-span-6 flex items-center pl-6 text-sm">
                <div className="flex items-center">
                  <div className="h-5 w-5 flex-shrink-0 text-slate-700">
                    <PlusIcon className="h-5 w-5" />
                  </div>
                  <div className="ml-4 text-left">
                    <div className="font-medium text-slate-900">
                      {isLoading ? "Loading" : "Add new action"}
                    </div>
                    <div className="text-xs text-slate-500">
                      Caputre a new user action with code or no-code tracking.
                    </div>
                  </div>
                </div>
              </div>
            </button>
          )}

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
      <ActionDetailModal
        environmentId={environmentId}
        open={isActionDetailModalOpen}
        setOpen={setActionDetailModalOpen}
        actionClasses={actionClasses}
        actionClass={activeActionClass}
        membershipRole={membershipRole}
        isUserTargetingEnabled={isUserTargetingEnabled}
      />
      <AddNoCodeActionModal
        environmentId={environmentId}
        open={isAddActionModalOpen}
        actionClasses={actionClasses}
        setOpen={setAddActionModalOpen}
        isViewer={isViewer}
      />
    </>
  );
}
