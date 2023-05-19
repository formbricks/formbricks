"use client";

import DeleteDialog from "@/components/shared/DeleteDialog";
import LoadingSpinner from "@/components/shared/LoadingSpinner";
import { useProfile } from "@/lib/profile";
import { Badge, Button } from "@formbricks/ui";
import { TrashIcon } from "@heroicons/react/24/outline";
import { useState } from "react";
import toast from "react-hot-toast";
import AddAlertModal from "./AddAlertModal";

export default function EditAlerts({ environmentId }) {
  const { profile, isLoadingProfile, isErrorProfile } = useProfile();
  const [isAddAlertModalOpen, setAddAlertModalOpen] = useState(false);
  const [activeAlert, setActiveAlert] = useState(null);
  const [isDeleteAlertModalOpen, setDeleteAlertModalOpen] = useState(false);

  const handleOpenDeleteAlertModal = (alert) => {
    setActiveAlert(alert);
    setDeleteAlertModalOpen(true);
  };

  const handleDeleteAlert = async () => {
    setDeleteAlertModalOpen(false);
    toast.success("Alert deleted");
  };

  const handleAddAlert = async (data) => {
    toast.success("Alert added");
  };

  /*   const handleEditAlert = async (data) => {
    e.preventDefault();
    setActiveAlert(alert);
    setAddAlertModalOpen();
  }; */

  const exampleAlerts = [
    {
      name: "New response",
      type: "Summary",
      surveys: ["Survey Name", "Survey Name 2"],
    },
    {
      name: "Product Team",
      type: "Responses",
      surveys: ["Survey Name", "Survey Name 2"],
    },
  ];

  if (isLoadingProfile) {
    return <LoadingSpinner />;
  }

  if (isErrorProfile) {
    return <div>Error</div>;
  }

  return (
    <>
      <div className="mb-5 text-right">
        <Button
          variant="darkCTA"
          onClick={() => {
            setAddAlertModalOpen(true);
          }}>
          Add Alert
        </Button>
      </div>
      <div className="rounded-lg border border-slate-200">
        <div className="grid h-12 grid-cols-8 content-center rounded-t-lg bg-slate-100 px-4 text-left text-sm font-semibold text-slate-900">
          <div className="col-span-2">Alert</div>
          <div className="col-span-2">Type</div>
          <div className="col-span-3">Surveys</div>
          <div className="col-span-1"></div>
          <div className=""></div>
        </div>
        <div className="grid-cols-8 space-y-1 p-2">
          {exampleAlerts.map((alert) => (
            <div
              onClick={() => {
                setAddAlertModalOpen(true);
              }}
              className="grid h-auto w-full cursor-pointer grid-cols-8 place-content-center rounded-lg px-2 py-1 text-left text-sm text-slate-900 hover:bg-slate-50"
              key={alert.name}>
              <div className="col-span-2 flex flex-col justify-center break-all">{alert.name}</div>
              <div className=" col-span-2 flex items-center ">
                <Badge size="normal" text={alert.type} type="gray"></Badge>
              </div>
              <div className="col-span-3 flex items-center">
                {alert.surveys.map((survey, index) => (
                  <span className="mr-2">
                    {survey}
                    {index !== alert.surveys.length - 1 && <span>,</span>}
                  </span>
                ))}
              </div>
              <div className="col-span-1 flex items-center justify-end gap-x-6 pr-6">
                <Button
                  variant="minimal"
                  className="z-10 px-2"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleOpenDeleteAlertModal(alert);
                  }}>
                  <TrashIcon className="h-5 w-5" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      </div>
      <AddAlertModal
        open={isAddAlertModalOpen}
        setOpen={setAddAlertModalOpen}
        onSubmit={handleAddAlert}
        environmentId={environmentId}
      />
      <DeleteDialog
        open={isDeleteAlertModalOpen}
        setOpen={setDeleteAlertModalOpen}
        deleteWhat="Alert"
        onDelete={handleDeleteAlert}
      />
    </>
  );
}
