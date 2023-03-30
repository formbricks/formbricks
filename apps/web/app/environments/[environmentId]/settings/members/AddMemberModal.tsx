"use client";

import Modal from "@/components/shared/Modal";
import { Button } from "@formbricks/ui";
import { Input } from "@formbricks/ui";
import { Label } from "@formbricks/ui";
import { useForm } from "react-hook-form";

interface MemberModalProps {
  open: boolean;
  setOpen: (v: boolean) => void;
  onSubmit: (data: { name: string; email: string }) => void;
}

export default function AddMemberModal({ open, setOpen, onSubmit }: MemberModalProps) {
  const { register, getValues, handleSubmit, reset } = useForm<{ name: string; email: string }>();

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
              <Button variant="primary" type="submit">
                Send Invitation
              </Button>
            </div>
          </div>
        </form>
      </div>
    </Modal>
  );
}
