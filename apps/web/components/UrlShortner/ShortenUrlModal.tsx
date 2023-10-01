import React from "react";
import Modal from "@/components/shared/Modal";
import { Button, Input, Label } from "@formbricks/ui";
import { useForm } from "react-hook-form";
import { LinkIcon } from "@heroicons/react/24/outline";

interface ShortenUrlModalProps {
  open: boolean;
  setOpen: (v: boolean) => void;
}

const ShortenUrlModal = ({ open, setOpen }: ShortenUrlModalProps) => {
  const { register, handleSubmit } = useForm();

  return (
    <Modal open={open} setOpen={setOpen} noPadding closeOnOutsideClick={false}>
      <div className="flex h-full flex-col rounded-lg">
        <div className="rounded-t-lg bg-slate-100">
          <div className="flex items-center justify-between p-6">
            <div className="flex items-center space-x-2">
              <div className="mr-1.5 h-10 w-10 text-slate-500">
                <LinkIcon />
              </div>
              <div>
                <div className="text-xl font-medium text-slate-700">URL shortner</div>
                <div className="text-sm text-slate-500">Create a short URL to make params less obvious.</div>
              </div>
            </div>
          </div>
        </div>
        <form onSubmit={(e) => e.preventDefault()}>
          <div className="flex w-full justify-between space-y-4 rounded-lg p-6 text-sm">
            <div className="grid w-full grid-cols-5 gap-x-2 gap-y-4">
              <div className="col-span-4">
                <Label>Paste URL</Label>
                <Input
                  className="h-11"
                  autoFocus
                  placeholder="https://formbricks.com/c..."
                  {...register("name", { required: true })}
                />
              </div>
              <Button className="h-11 self-end" variant="darkCTA">
                Shorten
              </Button>
              <div className="col-span-4">
                <Label>Short URL</Label>
                <div className="relative flex h-11 max-w-full items-center overflow-auto rounded-lg border border-slate-300 bg-slate-50 px-4 text-slate-800">
                  <span
                    style={{
                      wordBreak: "break-all",
                    }}>
                    https://formbricks.com/c...
                  </span>
                </div>
              </div>
              <Button className="h-11 self-end" variant="secondary">
                Copy
              </Button>
            </div>
          </div>
        </form>
      </div>
    </Modal>
  );
};

export default ShortenUrlModal;
