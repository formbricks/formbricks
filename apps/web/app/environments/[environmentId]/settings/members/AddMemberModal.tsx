"use client";

import Modal from "@/components/shared/Modal";
import {
  Button,
  Input,
  Label,
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@formbricks/ui";
import { useForm, Controller } from "react-hook-form";

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
}

export default function AddMemberModal({ open, setOpen, onSubmit }: MemberModalProps) {
  const { register, getValues, handleSubmit, reset, control } = useForm<{
    name: string;
    email: string;
    role: MembershipRole;
  }>();

  const submitEventClass = async () => {
    const data = getValues();
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
        <form onSubmit={handleSubmit(submitEventClass)}>
          <div className="flex justify-between rounded-lg p-6">
            <div className="w-full space-y-4">
              <div>
                <Label>Full Name</Label>
                <Input placeholder="e.g. Hans Wurst" {...register("name", { required: true })} />
              </div>
              <div>
                <Label>Email Adress</Label>
                <Input type="email" placeholder="hans@wurst.com" {...register("email", { required: true })} />
              </div>
              <Controller
                name="role"
                control={control}
                render={({ field: { onChange, value } }) => (
                  <div>
                    <Label>Role</Label>
                    <Select value={value} onValueChange={(v) => onChange(v as MembershipRole)}>
                      <SelectTrigger className="capitalize">
                        <SelectValue placeholder={<span className="text-slate-400">Select role</span>} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectGroup>
                          {Object.values(MembershipRole).map((role) => (
                            <SelectItem className="capitalize" key={role} value={role}>
                              {role}
                            </SelectItem>
                          ))}
                        </SelectGroup>
                      </SelectContent>
                    </Select>
                  </div>
                )}
              />
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
