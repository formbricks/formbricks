import { Button, Input, Label } from "@/../../packages/ui";
import Modal from "@/components/shared/Modal";
import { useForm } from "react-hook-form";
import { createIntegration } from "@formbricks/lib/client/airtable";
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

  const { register, handleSubmit } = useForm<Inputs>();

  const submitHandler = async (data: Inputs) => {
    const res = await createIntegration(environmentId, data.token);

    if (res.message) {
      toast.success(res.message);
      setOpenWithStates(false);
      setIsConnected(true);
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
              <Label htmlFor="token">Airtable Auth Token</Label>
              <div className="mt-1 flex">
                <Input type="text" id="token" {...register("token", { required: true })} />
              </div>
            </div>

            <div className="flex justify-end ">
              <Button type="submit">save</Button>
            </div>
          </div>
        </div>
      </form>
    </Modal>
  );
}
