import { triggers } from "@/app/(app)/environments/[environmentId]/integrations/webhooks/components/HardcodedTriggers";
import { SurveyCheckboxGroup } from "@/app/(app)/environments/[environmentId]/integrations/webhooks/components/SurveyCheckboxGroup";
import { TriggerCheckboxGroup } from "@/app/(app)/environments/[environmentId]/integrations/webhooks/components/TriggerCheckboxGroup";
import clsx from "clsx";
import { Webhook } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import toast from "react-hot-toast";
import { TPipelineTrigger } from "@formbricks/types/pipelines";
import { TSurvey } from "@formbricks/types/surveys/types";
import { TWebhookInput } from "@formbricks/types/webhooks";
import { Button } from "@formbricks/ui/Button";
import { Input } from "@formbricks/ui/Input";
import { Label } from "@formbricks/ui/Label";
import { Modal } from "@formbricks/ui/Modal";
import { createWebhookAction, testEndpointAction } from "../actions";

interface AddWebhookModalProps {
  environmentId: string;
  open: boolean;
  surveys: TSurvey[];
  setOpen: (v: boolean) => void;
}

export const AddWebhookModal = ({ environmentId, surveys, open, setOpen }: AddWebhookModalProps) => {
  const router = useRouter();
  const {
    handleSubmit,
    reset,
    register,
    formState: { isSubmitting },
  } = useForm();

  const [testEndpointInput, setTestEndpointInput] = useState("");
  const [hittingEndpoint, setHittingEndpoint] = useState<boolean>(false);
  const [endpointAccessible, setEndpointAccessible] = useState<boolean>();
  const [selectedTriggers, setSelectedTriggers] = useState<TPipelineTrigger[]>([]);
  const [selectedSurveys, setSelectedSurveys] = useState<string[]>([]);
  const [selectedAllSurveys, setSelectedAllSurveys] = useState(false);
  const [creatingWebhook, setCreatingWebhook] = useState(false);

  const handleTestEndpoint = async (sendSuccessToast: boolean) => {
    try {
      setHittingEndpoint(true);
      await testEndpointAction({ url: testEndpointInput });
      setHittingEndpoint(false);
      if (sendSuccessToast) toast.success("Yay! We are able to ping the webhook!");
      setEndpointAccessible(true);
      return true;
    } catch (err) {
      setHittingEndpoint(false);
      toast.error(
        `Unable to ping the webhook! \n ${err.message.length < 250 ? `Error:  ${err.message}` : "Please check the console for more details"}`,
        { className: err.message.length < 250 ? "break-all" : "" }
      );
      console.error("Webhook Test Failed due to: ", err.message);
      setEndpointAccessible(false);
      return false;
    }
  };

  const handleSelectAllSurveys = () => {
    setSelectedAllSurveys(!selectedAllSurveys);
    setSelectedSurveys([]);
  };

  const handleSelectedSurveyChange = (surveyId: string) => {
    setSelectedSurveys((prevSelectedSurveys: string[]) =>
      prevSelectedSurveys.includes(surveyId)
        ? prevSelectedSurveys.filter((id) => id !== surveyId)
        : [...prevSelectedSurveys, surveyId]
    );
  };

  const handleCheckboxChange = (selectedValue: TPipelineTrigger) => {
    setSelectedTriggers((prevValues) =>
      prevValues.includes(selectedValue)
        ? prevValues.filter((value) => value !== selectedValue)
        : [...prevValues, selectedValue]
    );
  };

  const submitWebhook = async (data: TWebhookInput): Promise<void> => {
    if (!isSubmitting) {
      try {
        setCreatingWebhook(true);
        if (!testEndpointInput || testEndpointInput === "") {
          throw new Error("Please enter a URL");
        }
        if (selectedTriggers.length === 0) {
          throw new Error("Please select at least one trigger");
        }

        if (!selectedAllSurveys && selectedSurveys.length === 0) {
          throw new Error("Please select at least one survey");
        }

        const endpointHitSuccessfully = await handleTestEndpoint(false);
        if (!endpointHitSuccessfully) return;

        const updatedData: TWebhookInput = {
          name: data.name,
          url: testEndpointInput,
          source: "user",
          triggers: selectedTriggers,
          surveyIds: selectedSurveys,
        };

        await createWebhookAction({ environmentId, webhookInput: updatedData });
        router.refresh();
        setOpenWithStates(false);
        toast.success("Webhook added successfully.");
      } catch (e) {
        toast.error(e.message);
      } finally {
        setCreatingWebhook(false);
      }
    }
  };

  const setOpenWithStates = (isOpen: boolean) => {
    setOpen(isOpen);
    reset();
    setTestEndpointInput("");
    setEndpointAccessible(undefined);
    setSelectedSurveys([]);
    setSelectedTriggers([]);
    setSelectedAllSurveys(false);
  };

  return (
    <Modal open={open} setOpen={setOpenWithStates} noPadding closeOnOutsideClick={true}>
      <div className="flex h-full flex-col rounded-lg">
        <div className="rounded-t-lg bg-slate-100">
          <div className="flex w-full items-center justify-between p-6">
            <div className="flex items-center space-x-2">
              <div className="mr-1.5 h-6 w-6 text-slate-500">
                <Webhook />
              </div>
              <div>
                <div className="text-xl font-medium text-slate-700">Add Webhook</div>
                <div className="text-sm text-slate-500">Send survey response data to a custom endpoint</div>
              </div>
            </div>
          </div>
        </div>
        <form onSubmit={handleSubmit(submitWebhook)}>
          <div className="flex justify-between rounded-lg p-6">
            <div className="w-full space-y-4">
              <div className="col-span-1">
                <Label htmlFor="name">Name</Label>
                <div className="mt-1 flex">
                  <Input
                    type="text"
                    id="name"
                    {...register("name")}
                    placeholder="Optional: Label your webhook for easy identification"
                  />
                </div>
              </div>

              <div className="col-span-1">
                <Label htmlFor="URL">URL</Label>
                <div className="mt-1 flex">
                  <Input
                    type="url"
                    id="URL"
                    value={testEndpointInput}
                    onChange={(e) => {
                      setTestEndpointInput(e.target.value);
                    }}
                    className={clsx(
                      endpointAccessible === true
                        ? "border-green-500 bg-green-50"
                        : endpointAccessible === false
                          ? "border-red-200 bg-red-50"
                          : endpointAccessible === undefined
                            ? "border-slate-200 bg-white"
                            : null
                    )}
                    placeholder="Paste the URL you want the event to trigger on"
                  />
                  <Button
                    type="button"
                    variant="secondary"
                    loading={hittingEndpoint}
                    className="ml-2 whitespace-nowrap"
                    disabled={testEndpointInput.trim() === ""}
                    onClick={() => {
                      handleTestEndpoint(true);
                    }}>
                    Test Endpoint
                  </Button>
                </div>
              </div>

              <div>
                <Label htmlFor="Triggers">Triggers</Label>
                <TriggerCheckboxGroup
                  triggers={triggers}
                  selectedTriggers={selectedTriggers}
                  onCheckboxChange={handleCheckboxChange}
                  allowChanges={true}
                />
              </div>

              <div>
                <Label htmlFor="Surveys">Surveys</Label>
                <SurveyCheckboxGroup
                  surveys={surveys}
                  selectedSurveys={selectedSurveys}
                  selectedAllSurveys={selectedAllSurveys}
                  onSelectAllSurveys={handleSelectAllSurveys}
                  onSelectedSurveyChange={handleSelectedSurveyChange}
                  allowChanges={true}
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
                  setOpenWithStates(false);
                }}>
                Cancel
              </Button>
              <Button type="submit" loading={creatingWebhook}>
                Add Webhook
              </Button>
            </div>
          </div>
        </form>
      </div>
    </Modal>
  );
};
