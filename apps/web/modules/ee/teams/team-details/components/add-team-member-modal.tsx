"use client";

import { UserIcon } from "lucide-react";
import { useState } from "react";
import toast from "react-hot-toast";
import { getFormattedErrorMessage } from "@formbricks/lib/actionClient/helper";
import { Button } from "@formbricks/ui/components/Button";
import { Label } from "@formbricks/ui/components/Label";
import { Modal } from "@formbricks/ui/components/Modal";
import { H4 } from "@formbricks/ui/components/Typography";

interface AddTeamMemberModalProps {
  open: boolean;
  setOpen: React.Dispatch<React.SetStateAction<boolean>>;
}

export const AddTeamMemberModal = ({ open, setOpen }: AddTeamMemberModalProps) => {
  return (
    <Modal noPadding closeOnOutsideClick={true} size="md" open={open} setOpen={setOpen}>
      <div className="rounded-t-lg bg-slate-100">
        <div className="flex w-full items-center gap-4 p-6">
          <div className="flex items-center space-x-2">
            <UserIcon className="h-5 w-5" />
            <H4>Add members</H4>
          </div>
        </div>
      </div>
      <div className="flex flex-col overflow-auto rounded-lg bg-white p-6">
        <Label className="mb-1 text-sm font-medium text-slate-900">Organization Members</Label>
      </div>
    </Modal>
  );
};
