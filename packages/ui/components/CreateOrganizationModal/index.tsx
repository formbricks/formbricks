import { PlusCircleIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import toast from "react-hot-toast";
import { getFormattedErrorMessage } from "@formbricks/lib/actionClient/helper";
import { createOrganizationAction } from "../../../apps/web/app/(app)/environments/[environmentId]/actions";
import { Button } from "../Button";
import { Input } from "../Input";
import { Label } from "../Label";
import { Modal } from "../Modal";

interface CreateOrganizationModalProps {
  open: boolean;
  setOpen: (v: boolean) => void;
}

type FormValues = {
  name: string;
};

export const CreateOrganizationModal = ({ open, setOpen }: CreateOrganizationModalProps) => {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [organizationName, setOrganizationName] = useState("");
  const isOrganizationNameValid = organizationName.trim() !== "";
  const { register, handleSubmit } = useForm<FormValues>();

  const submitOrganization = async (data: FormValues) => {
    data.name = data.name.trim();
    if (!data.name) return;

    setLoading(true);
    const createOrganizationResponse = await createOrganizationAction({ organizationName: data.name });
    if (createOrganizationResponse?.data) {
      toast.success("Organization created successfully!");
      router.push(`/organizations/${createOrganizationResponse.data.id}`);
      setOpen(false);
    } else {
      const errorMessage = getFormattedErrorMessage(createOrganizationResponse);
      toast.error(errorMessage);
      console.error(errorMessage);
    }

    setLoading(false);
  };

  return (
    <Modal open={open} setOpen={setOpen} noPadding closeOnOutsideClick={false}>
      <div className="flex h-full flex-col rounded-lg">
        <div className="rounded-t-lg bg-slate-100">
          <div className="flex items-center justify-between p-6">
            <div className="flex items-center space-x-2">
              <div className="mr-1.5 h-10 w-10 text-slate-500">
                <PlusCircleIcon className="h-5 w-5" />
              </div>
              <div>
                <div className="text-xl font-medium text-slate-700">Create organization</div>
                <div className="text-sm text-slate-500">
                  Create a new organization to handle a different set of products.
                </div>
              </div>
            </div>
          </div>
        </div>
        <form onSubmit={handleSubmit(submitOrganization)}>
          <div className="flex w-full justify-between space-y-4 rounded-lg p-6">
            <div className="grid w-full gap-x-2">
              <div>
                <Label>Organization Name</Label>
                <Input
                  autoFocus
                  placeholder="e.g. Power Puff Girls"
                  {...register("name", { required: true })}
                  value={organizationName}
                  onChange={(e) => setOrganizationName(e.target.value)}
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
              <Button type="submit" loading={loading} disabled={!isOrganizationNameValid}>
                Create organization
              </Button>
            </div>
          </div>
        </form>
      </div>
    </Modal>
  );
};
