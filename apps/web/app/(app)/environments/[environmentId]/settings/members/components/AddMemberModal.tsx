"use client";

import { useForm } from "react-hook-form";

import { AddMemberRole } from "@formbricks/ee/RoleManagement/components/AddMemberRole";
import { Button } from "@formbricks/ui/Button";
import { Input } from "@formbricks/ui/Input";
import { Label } from "@formbricks/ui/Label";
import { Modal } from "@formbricks/ui/Modal";
import { UpgradePlanNotice } from "@formbricks/ui/UpgradePlanNotice";

enum MembershipRole {
  Admin = "admin",
  Editor = "editor",
  Developer = "developer",
  Viewer = "viewer",
}
interface MemberModalProps {
  open: boolean;
  setOpen: (v: boolean) => void;
  onSubmit: (data: { name: string; email: string; role: MembershipRole }) => void;
  isEnterpriseEdition: boolean;
}

export default function AddMemberModal({ open, setOpen, onSubmit, isEnterpriseEdition }: MemberModalProps) {
  const { register, getValues, handleSubmit, reset, control } = useForm<{
    name: string;
    email: string;
    role: MembershipRole;
  }>();

  const submitEventClass = async () => {
    const data = getValues();
    data.role = data.role || MembershipRole.Admin;
    onSubmit(data);
    setOpen(false);
    reset();
  };

  return (
    <Modal open={open} setOpen={setOpen} noPadding closeOnOutsideClick={false}>
      <div className="flex h-full flex-col rounded-lg">
        <div className="rounded-t-lg bg-slate-100">
          <div className="flex items-center justify-between p-6">
            <div className="flex items-center space-x-2">
              <div className="text-xl font-medium text-slate-700">Invite Team Member</div>
            </div>
          </div>
        </div>
        {!isEnterpriseEdition && (
          <div className="mx-6 mt-2">
            <UpgradePlanNotice message="Upgrade to an Enterprise License to manage access roles for your team" />
          </div>
        )}
        <form onSubmit={handleSubmit(submitEventClass)}>
          <div className="flex justify-between rounded-lg p-6">
            <div className="w-full space-y-4">
              <div>
                <Label>Full Name</Label>
                <Input
                  placeholder="e.g. Hans Wurst"
                  {...register("name", { required: true, validate: (value) => value.trim() !== "" })}
                />
              </div>
              <div>
                <Label>Email Adress</Label>
                <Input type="email" placeholder="hans@wurst.com" {...register("email", { required: true })} />
              </div>
              {isEnterpriseEdition && <AddMemberRole control={control} />}
            </div>
          </div>
          <div className="flex justify-end border-t border-slate-200 p-6">
            <div className="flex space-x-2">
              <Button
                type="button"
                variant="minimal"
                onClick={() => {
                  setOpen(false);
                }}>
                Cancel
              </Button>
              <Button variant="darkCTA" type="submit">
                Send Invitation
              </Button>
            </div>
          </div>
        </form>
      </div>
    </Modal>
  );
}
