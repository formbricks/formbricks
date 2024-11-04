"use client";

import { addTeamMembersAction } from "@/modules/ee/teams/team-details/actions";
import { UserIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import toast from "react-hot-toast";
import { getFormattedErrorMessage } from "@formbricks/lib/actionClient/helper";
import { Button } from "@formbricks/ui/components/Button";
import { Label } from "@formbricks/ui/components/Label";
import { Modal } from "@formbricks/ui/components/Modal";
import { MultiSelect } from "@formbricks/ui/components/MultiSelect";
import { H4 } from "@formbricks/ui/components/Typography";

interface AddTeamMemberModalProps {
  open: boolean;
  setOpen: React.Dispatch<React.SetStateAction<boolean>>;
  teamId: string;
  organizationMemberOptions: { label: string; value: string }[];
}

export const AddTeamMemberModal = ({
  open,
  setOpen,
  teamId,
  organizationMemberOptions,
}: AddTeamMemberModalProps) => {
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const router = useRouter();

  const handleAddMembers = async (e) => {
    e.preventDefault();

    setIsLoading(true);
    const addMembersActionResponse = await addTeamMembersAction({
      teamId,
      userIds: selectedUsers,
    });
    if (addMembersActionResponse?.data) {
      toast.success("Members added successfully");
      router.refresh();
    } else {
      const errorMessage = getFormattedErrorMessage(addMembersActionResponse);
      toast.error(errorMessage);
    }

    setSelectedUsers([]);
    setIsLoading(false);
    setOpen(false);
  };

  return (
    <Modal noPadding size="md" open={open} setOpen={setOpen} className="overflow-visible">
      <div className="rounded-t-lg bg-slate-100">
        <div className="flex w-full items-center gap-4 p-6">
          <div className="flex items-center space-x-2">
            <UserIcon className="h-5 w-5" />
            <H4>Add members</H4>
          </div>
        </div>
      </div>
      <form onSubmit={handleAddMembers}>
        <div className="overflow-visible p-6">
          <Label className="mb-1 text-sm font-medium text-slate-900">Organization Members</Label>
          <MultiSelect
            value={selectedUsers}
            options={organizationMemberOptions}
            onChange={(value) => {
              setSelectedUsers(value);
            }}
          />
        </div>
        <div className="flex items-end justify-end gap-2 p-6 pt-0">
          <Button
            variant="secondary"
            type="button"
            onClick={() => {
              setOpen(false);
              setSelectedUsers([]);
            }}>
            Cancel
          </Button>
          <Button variant="primary" disabled={isLoading} loading={isLoading} type="submit">
            Add
          </Button>
        </div>
      </form>
    </Modal>
  );
};