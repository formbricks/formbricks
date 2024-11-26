"use client";

import { AlertTriangleIcon } from "lucide-react";
import { useForm } from "react-hook-form";
import { Button } from "@formbricks/ui/Button";
import { Input } from "@formbricks/ui/Input";
import { Label } from "@formbricks/ui/Label";
import { Modal } from "@formbricks/ui/Modal";

interface MemberModalProps {
  open: boolean;
  setOpen: (v: boolean) => void;
  onSubmit: (data: { label: string; environment: string }) => void;
}

export const AddApiKeyModal = ({ open, setOpen, onSubmit }: MemberModalProps) => {
  const { register, getValues, handleSubmit, reset } = useForm<{ label: string; environment: string }>();

  const submitAPIKey = async () => {
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
              <div className="text-xl font-medium text-slate-700">Add API Key</div>
            </div>
          </div>
        </div>
        <form onSubmit={handleSubmit(submitAPIKey)}>
          <div className="flex justify-between rounded-lg p-6">
            <div className="w-full space-y-4">
              <div>
                <Label>API Key Label</Label>
                <Input
                  placeholder="e.g. GitHub, PostHog, Slack"
                  {...register("label", { required: true, validate: (value) => value.trim() !== "" })}
                />
              </div>

              <div className="flex items-center rounded-lg border border-slate-200 bg-slate-100 p-2 text-sm text-slate-700">
                <AlertTriangleIcon className="mx-3 h-12 w-12 text-amber-500" />
                <p>
                  For security reasons, the API key will only be <strong>shown once</strong> after creation.
                  Please copy it to your destination right away.
                </p>
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
              <Button type="submit">Add API Key</Button>
            </div>
          </div>
        </form>
      </div>
    </Modal>
  );
};
