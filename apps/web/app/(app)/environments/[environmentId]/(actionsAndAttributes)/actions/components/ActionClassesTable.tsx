"use client";

import { Button } from "@formbricks/ui/Button";
import { CursorArrowRaysIcon } from "@heroicons/react/24/solid";
import { useState } from "react";
import AddNoCodeActionModal from "./AddNoCodeActionModal";
import ActionDetailModal from "./ActionDetailModal";
import { TActionClass } from "@formbricks/types/actionClasses";
import useFindUserMembershipRole from "@formbricks/lib/hooks/membership/useFindUserMembershipRole";

export default function ActionClassesTable({
  environmentId,
  actionClasses,
  children: [TableHeading, actionRows],
}: {
  environmentId: string;
  actionClasses: TActionClass[];
  children: [JSX.Element, JSX.Element[]];
}) {
  const [isActionDetailModalOpen, setActionDetailModalOpen] = useState(false);
  const [isAddActionModalOpen, setAddActionModalOpen] = useState(false);
  const [membershipRole] = useFindUserMembershipRole(environmentId);

  const [activeActionClass, setActiveActionClass] = useState<TActionClass>({
    environmentId,
    id: "",
    name: "",
    type: "noCode",
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

  return (
    <>
      {membershipRole !== "viewer" && (
        <div className="mb-6 text-right">
          <Button
            variant="darkCTA"
            onClick={() => {
              setAddActionModalOpen(true);
            }}>
            <CursorArrowRaysIcon className="mr-2 h-5 w-5 text-white" />
            Add Action
          </Button>
        </div>
      )}
      <div className="rounded-lg border border-slate-200">
        {TableHeading}
        <div className="grid-cols-7">
          {actionClasses.map((actionClass, index) => (
            <button
              onClick={(e) => {
                handleOpenActionDetailModalClick(e, actionClass);
              }}
              className="w-full"
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
        actionClass={activeActionClass}
      />
      <AddNoCodeActionModal
        environmentId={environmentId}
        open={isAddActionModalOpen}
        setOpen={setAddActionModalOpen}
      />
    </>
  );
}
