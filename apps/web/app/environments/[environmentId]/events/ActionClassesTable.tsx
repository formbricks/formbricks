"use client";

import { Button } from "@formbricks/ui";
import { CursorArrowRaysIcon } from "@heroicons/react/24/solid";
import { useState } from "react";
import AddNoCodeActionModal from "./AddNoCodeActionModal";
import ActionDetailModal from "./EventDetailModal";
import { useRouter } from "next/navigation";
import { TAction } from "@formbricks/types/v1/actions";

export default function ActionClassesTable({
  environmentId,
  actionClasses,
  children: [TableHeading, actionRows],
}: {
  environmentId: string;
  actionClasses: TAction[];
  children: [JSX.Element, JSX.Element[]];
}) {
  const router = useRouter();
  const [isActionDetailModalOpen, setActionDetailModalOpen] = useState(false);
  const [isAddActionModalOpen, setAddActionModalOpen] = useState(false);

  const [activeActionClass, setActiveActionClass] = useState("" as any);

  const handleOpenActionDetailModalClick = (e, actionClass) => {
    e.preventDefault();
    setActiveActionClass(actionClass);
    setActionDetailModalOpen(true);
  };

  const mutateActionClasses = () => {
    router.refresh();
  };

  return (
    <>
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
        eventClass={activeActionClass}
      />
      <AddNoCodeActionModal
        environmentId={environmentId}
        open={isAddActionModalOpen}
        setOpen={setAddActionModalOpen}
        mutateEventClasses={mutateActionClasses}
      />
    </>
  );
}
