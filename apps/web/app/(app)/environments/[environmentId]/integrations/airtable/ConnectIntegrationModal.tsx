import { Button, Label, PasswordInput } from "@/../../packages/ui";
import Modal from "@/components/shared/Modal";
import { createIntegration } from "@formbricks/lib/client/airtable";
import { ArrowTopRightOnSquareIcon } from "@heroicons/react/24/outline";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { toast } from "react-hot-toast";

interface AirTableConnectIntegrationModalProps {
  open: boolean;
  setOpenWithStates: (v: boolean) => void;
  setIsConnected: (v: boolean) => void;
  environmentId: string;
}

type Inputs = {
  token: string;
};

export default function AirTableConnectIntegrationModal(props: AirTableConnectIntegrationModalProps) {
  const { open, setOpenWithStates, environmentId, setIsConnected } = props;
  const router = useRouter();
  const {
    register,
    handleSubmit,
    formState: { isSubmitting },
  } = useForm<Inputs>();

  const submitHandler = async (data: Inputs) => {
    const res = await createIntegration(environmentId, data.token);

    if (res.message) {
      toast.success(res.message);
      setOpenWithStates(false);
      setIsConnected(true);
      router.refresh();
    } else {
      const message = res?.Error ?? "An unknown error occurred";

      toast.error(message);
    }
  };
  return (
    <Modal open={open} setOpen={setOpenWithStates} noPadding>
      <form onSubmit={handleSubmit(submitHandler)}>
        <div className="flex rounded-lg p-6">
          <div className="flex w-full flex-col gap-y-4 pt-5">
            <div className="flex w-full flex-col">
              <Label htmlFor="token">Add an Airtable Personal Access Token:</Label>
              <div className="mt-2 flex">
                <PasswordInput
                  containerClassName="w-full"
                  id="token"
                  {...register("token", { required: true })}
                />
              </div>
              <div>
                <p className="my-4 text-sm text-slate-700">
                  Please make sure to have following scopes enable:
                </p>
                <ul className="list-inside space-y-1 text-sm">
                  <li>
                    <code className="rounded-md bg-slate-200 p-0.5 text-slate-600">data.records:read</code>
                  </li>
                  <li>
                    <code className="rounded-md bg-slate-200 p-0.5 text-slate-600">data.records:write</code>
                  </li>
                  <li>
                    <code className="rounded-md bg-slate-200 p-0.5 text-slate-600">schema.bases:read</code>
                  </li>
                  <li>
                    <code className="rounded-md bg-slate-200 p-0.5 text-slate-600">schema.bases:write</code>
                  </li>
                  <li>
                    <code className="rounded-md bg-slate-200 p-0.5 text-slate-600">user.email:read</code>
                  </li>
                </ul>
              </div>
              <a
                className="mt-2 pt-2 text-sm text-slate-700 underline underline-offset-2 hover:text-slate-800"
                href="https://airtable.com/developers/web/guides/personal-access-tokens">
                Airtable Token Docs
                <ArrowTopRightOnSquareIcon className="ml-2 inline-block h-4 w-4 text-slate-600" />
              </a>
            </div>

            <div className="flex justify-end ">
              <Button variant="darkCTA" loading={isSubmitting} type="submit">
                Save
              </Button>
            </div>
          </div>
        </div>
      </form>
    </Modal>
  );
}
