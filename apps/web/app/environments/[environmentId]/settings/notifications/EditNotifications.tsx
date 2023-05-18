"use client";

import DeleteDialog from "@/components/shared/DeleteDialog";
import LoadingSpinner from "@/components/shared/LoadingSpinner";
import { useProfile } from "@/lib/profile";
import { Badge, Button, ProfileAvatar } from "@formbricks/ui";
import { TrashIcon } from "@heroicons/react/24/outline";
import { useState } from "react";
import toast from "react-hot-toast";
import AddNotificationModal from "./AddNotificationModal";

export default function EditNotifications({}) {
  const { profile, isLoadingProfile, isErrorProfile } = useProfile();
  const [isAddNotificationModalOpen, setAddNotificationModalOpen] = useState(false);
  const [isDeleteNotificationModalOpen, setDeleteNotificationModalOpen] = useState(false);

  /*   const handleOpenDeleteNotificationModal = (e, member) => {
    e.preventDefault();
    setActiveNotification(member);
    setDeleteNotificationModalOpen(true);
  };
  const handleDeleteNotification = async () => {
    if (activeNotification.accepted) {
      await removeNotification(team.teamId, activeNotification.userId);
    } else {
      await deleteInvite(team.teamId, activeNotification.inviteId);
    }
    setDeleteNotificationModalOpen(false);
    mutateTeam();
  }; */
  const handleAddNotification = async (data) => {
    toast.success("Notification added");
  };

  if (isLoadingProfile) {
    return <LoadingSpinner />;
  }

  if (isErrorProfile) {
    return <div>Error</div>;
  }

  return (
    <>
      <div className="mb-6 text-right">
        <Button
          variant="primary"
          onClick={() => {
            setAddNotificationModalOpen(true);
          }}>
          Add Notification
        </Button>
      </div>
      <div className="rounded-lg border border-slate-200">
        <div className="grid h-12 grid-cols-7 content-center rounded-t-lg bg-slate-100 text-left text-sm font-semibold text-slate-900">
          <div className="px-6"></div>
          <div className="col-span-2">Fullname</div>
          <div className="col-span-2">Email</div>
          <div className=""></div>
        </div>
        {/*     <div className="grid-cols-7">
          {[...team.members, ...team.invitees].map((member) => (
            <div
              className="grid h-auto w-full grid-cols-7 content-center rounded-lg p-0.5 py-2 text-left text-sm text-slate-900"
              key={member.email}>
              <div className="h-58 px-6 ">
                <ProfileAvatar userId={member.userId || member.email} />
              </div>
              <div className="ph-no-capture col-span-2 flex flex-col justify-center break-all">
                <p>{member.name}</p>
              </div>
              <div className="ph-no-capture col-span-2 flex flex-col justify-center break-all">
                {member.email}
              </div>
              <div className="col-span-2 flex items-center justify-end gap-x-6 pr-6">
                {!member.accepted && <Badge type="warning" text="Pending" size="tiny" />}
                {member.role !== "owner" && (
                  <button onClick={(e) => handleOpenDeleteNotificationModal(e, member)}>
                    <TrashIcon className="h-5 w-5 text-slate-700 hover:text-slate-500" />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div> */}
      </div>

      <AddNotificationModal
        open={isAddNotificationModalOpen}
        setOpen={setAddNotificationModalOpen}
        onSubmit={handleAddNotification}
      />
      {/*       <DeleteDialog
        open={isDeleteNotificationModalOpen}
        setOpen={setDeleteNotificationModalOpen}
        deleteWhat="notification"
        onDelete={handleDeleteNotification}
      /> */}
    </>
  );
}
