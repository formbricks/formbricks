import { Button, Label, PasswordInput } from "@/../../packages/ui";
import Modal from "@/components/shared/Modal";
import { useForm } from "react-hook-form";
import { createIntegration } from "@formbricks/lib/client/airtable";
import { toast } from "react-hot-toast";
import { useRouter } from "next/navigation";

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
              <Label htmlFor="token">Airtable personal Access token</Label>
              <div className="mt-2 flex">
                <PasswordInput
                  containerClassName="w-full"
                  id="token"
                  {...register("token", { required: true })}
                />
              </div>
              <p className="pt-2 text-sm leading-loose text-slate-500">
                <a
                  className="underline underline-offset-2 hover:text-slate-900"
                  href="https://airtable.com/developers/web/guides/personal-access-tokens">
                  Token
                </a>{" "}
                should have following scopes enabled{" "}
                <code className="rounded-md bg-slate-200 p-0.5 text-slate-600">data.records:read</code> ,{" "}
                <code className="rounded-md bg-slate-200 p-0.5 text-slate-600">data.records:write</code> ,{" "}
                <code className="rounded-md bg-slate-200 p-0.5 text-slate-600">schema.bases:read</code> ,{" "}
                <code className="rounded-md bg-slate-200 p-0.5 text-slate-600">schema.bases:write</code> and{" "}
                <code className="rounded-md bg-slate-200 p-0.5 text-slate-600">user.email:read</code>
              </p>
            </div>

            <div className="flex justify-end ">
              <Button loading={isSubmitting} type="submit">
                save
              </Button>
            </div>
          </div>
        </div>
      </form>
    </Modal>
  );
}
