"use client";

import Modal from "@/components/shared/Modal";
import { Button, Checkbox, Input, Label } from "@formbricks/ui";
import { useForm } from "react-hook-form";
import { PlusIcon } from "@heroicons/react/24/outline";

interface NotificationModalProps {
  open: boolean;
  setOpen: (v: boolean) => void;
  onSubmit: (data: { name: string; email_1: string; email_2: string; email_3: string }) => void;
}

export default function AddNotificationModal({ open, setOpen, onSubmit }: NotificationModalProps) {
  const { register, getValues, handleSubmit, reset } = useForm<{
    name: string;
    email_1: string;
    email_2: string;
    email_3: string;
  }>();

  const submitEventClass = async () => {
    const data = getValues();
    onSubmit(data);
    setOpen(false);
    reset();
  };

  return (
    <Modal open={open} setOpen={setOpen} noPadding closeOnOutsideClick={true}>
      <div className="flex h-full flex-col rounded-lg">
        <div className="rounded-t-lg bg-slate-100">
          <div className="flex items-center justify-between p-6">
            <div className="flex items-center space-x-2">
              <div className="text-xl font-medium text-slate-700">Add Email Alert</div>
            </div>
          </div>
        </div>
        <form onSubmit={handleSubmit(submitEventClass)}>
          <div className="flex justify-between rounded-lg p-6">
            <div className="w-full space-y-4">
              <div>
                <Label>Alert Name</Label>
                <Input placeholder="e.g. Product Team Info" {...register("name", { required: true })} />
              </div>
              <div>
                <Label>Trigger Event</Label>
                <p className="mb-2 mt-1 text-sm font-normal text-slate-400">
                  Send an email on every response these surveys get:
                </p>
                <div className="rounded-lg bg-slate-50 p-4">
                  <Checkbox
                    className="bg-white"
                    id="any-survey" /* {...register("email", { required: true })} */
                  />
                  <Label htmlFor="any-survey" className="ml-2 text-base">
                    All surveys
                  </Label>
                  <hr className="my-2" />
                </div>
              </div>
              <div>
                <Label>Email Recipients</Label>
                <div className="space-y-2">
                  <Input
                    id="email-1"
                    placeholder="bob@company.com"
                    aria-placeholder="example email"
                    {...register("email_1", { required: true })}
                  />
                  <Input
                    id="email-2"
                    placeholder="bob@company.com"
                    aria-placeholder="example email"
                    {...register("email_2", { required: true })}
                  />
                  <Input
                    id="email-3"
                    placeholder="bob@company.com"
                    aria-placeholder="example email"
                    {...register("email_3", { required: true })}
                  />
                  <Button variant="minimal" EndIcon={PlusIcon} endIconClassName="p-0.5" className="px-2">
                    Add email
                  </Button>
                </div>
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
