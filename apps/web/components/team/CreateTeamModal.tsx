import { createTeamAction } from "@/app/(app)/environments/[environmentId]/actions";
import Modal from "@/components/shared/Modal";
import { Button, Input, Label } from "@formbricks/ui";
import { PlusCircleIcon } from "@heroicons/react/24/outline";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import toast from "react-hot-toast";

interface CreateTeamModalProps {
  open: boolean;
  setOpen: (v: boolean) => void;
}

export default function CreateTeamModal({ open, setOpen }: CreateTeamModalProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const { register, handleSubmit } = useForm();

  const submitTeam = async (data) => {
    setLoading(true);
    const newTeam = await createTeamAction(data.name);

    toast.success("Team created successfully!");
    router.push(`/teams/${newTeam.id}`);
    setOpen(false);
    setLoading(false);
  };

  return (
    <Modal open={open} setOpen={setOpen} noPadding closeOnOutsideClick={false}>
      <div className="flex h-full flex-col rounded-lg">
        <div className="rounded-t-lg bg-slate-100">
          <div className="flex items-center justify-between p-6">
            <div className="flex items-center space-x-2">
              <div className="mr-1.5 h-10 w-10 text-slate-500">
                <PlusCircleIcon />
              </div>
              <div>
                <div className="text-xl font-medium text-slate-700">Create team</div>
                <div className="text-sm text-slate-500">
                  Create a new team to handle a different set of products.
                </div>
              </div>
            </div>
          </div>
        </div>
        <form onSubmit={handleSubmit(submitTeam)}>
          <div className="flex w-full justify-between space-y-4 rounded-lg p-6">
            <div className="grid w-full gap-x-2">
              <div>
                <Label>Team Name</Label>
                <Input
                  autoFocus
                  placeholder="e.g. Power Puff Girls"
                  {...register("name", { required: true })}
                />
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
              <Button variant="darkCTA" type="submit" loading={loading}>
                Create team
              </Button>
            </div>
          </div>
        </form>
      </div>
    </Modal>
  );
}
