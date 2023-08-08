"use client";

import { testEndpoint } from "@/app/(app)/environments/[environmentId]/integrations/custom-webhook/testEndpoint";
import Modal from "@/components/shared/Modal";
import { createWebhook } from "@formbricks/lib/services/webhook";
import { TPipelineTrigger } from "@formbricks/types/v1/pipelines";
import { TSurvey } from "@formbricks/types/v1/surveys";
import { TWebhookInput } from "@formbricks/types/v1/webhooks";
import { Button, Checkbox, Input, Label } from "@formbricks/ui";
import clsx from "clsx";
import { Webhook } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import toast from "react-hot-toast";

interface AddWebhookModalProps {
  environmentId: string;
  open: boolean;
  surveys: TSurvey[];
  setOpen: (v: boolean) => void;
}

const triggers = [
  { title: "Response Created", value: "responseCreated" as TPipelineTrigger },
  { title: "Response Updated", value: "responseUpdated" as TPipelineTrigger },
  { title: "Response Finished", value: "responseFinished" as TPipelineTrigger },
];

export default function AddWebhookModal({ environmentId, surveys, open, setOpen }: AddWebhookModalProps) {
  const router = useRouter();
  const { handleSubmit, reset } = useForm();
  const [testEndpointInput, setTestEndpointInput] = useState("");
  const [hittingEndpoint, setHittingEndpoint] = useState<boolean>(false);
  const [endpointAccessible, setEndpointAccessible] = useState<boolean>();
  const [selectedTriggers, setSelectedTriggers] = useState<TPipelineTrigger[]>([]);
  const [selectedSurveys, setSelectedSurveys] = useState<string[]>([]);
  const [selectedAllSurveys, setSelectedAllSurveys] = useState(false);
  const [creatingWebhook, setCreatingWebhook] = useState(false);

  const submitWebhook = async (): Promise<void> => {
    setCreatingWebhook(true);
    if (testEndpointInput === undefined || testEndpointInput === "") {
      toast.error("Please enter a URL");
      setCreatingWebhook(false);
      return;
    }
    if (selectedTriggers.length === 0) {
      toast.error("Please select at least one trigger");
      setCreatingWebhook(false);
      return;
    }

    if (!selectedAllSurveys && selectedSurveys.length === 0) {
      toast.error("Please select at least one survey");
      setCreatingWebhook(false);
      return;
    }

    const updatedData: TWebhookInput = {
      url: testEndpointInput,
      triggers: selectedTriggers,
      surveyIds: selectedSurveys,
    };
    try {
      const endpointHitSuccessfully = await handleTestEndpoint();
      if (!endpointHitSuccessfully) {
        setCreatingWebhook(false);
        return;
      }
      await createWebhook(environmentId, updatedData);
      router.refresh();
      resetStates();
      reset();
      setOpen(false);
      setCreatingWebhook(false);
      toast.success("Webhook added successfully.");
    } catch (e) {
      toast.error(e.message);
      return;
    }
  };

  const resetStates = () => {
    setTestEndpointInput("");
    setEndpointAccessible(undefined);
    setSelectedSurveys([]);
    setSelectedTriggers([]);
    setSelectedAllSurveys(false);
  };

  const handleSelectAllSurveys = () => {
    setSelectedAllSurveys(!selectedAllSurveys);
    setSelectedSurveys([]);
  };

  const handleSelectedSurveyChange = (surveyId) => {
    setSelectedSurveys((prevSelectedSurveys) => {
      if (prevSelectedSurveys.includes(surveyId)) {
        return prevSelectedSurveys.filter((id) => id !== surveyId);
      } else {
        return [...prevSelectedSurveys, surveyId];
      }
    });
  };

  const handleCheckboxChange = (selectedValue) => {
    setSelectedTriggers((prevValues) => {
      if (prevValues.includes(selectedValue)) {
        return prevValues.filter((value) => value !== selectedValue);
      } else {
        return [...prevValues, selectedValue];
      }
    });
  };

  const handleTestEndpoint = async () => {
    try {
      setHittingEndpoint(true);
      await testEndpoint(testEndpointInput);
      setHittingEndpoint(false);
      toast.success("Yay! We are able to ping the webhook!");
      setEndpointAccessible(true);
      return true;
    } catch (err) {
      setHittingEndpoint(false);
      toast.error("Oh no! We are unable to ping the webhook!");
      setEndpointAccessible(false);
      return false;
    }
  };

  return (
    <Modal open={open} setOpen={setOpen} noPadding closeOnOutsideClick={false}>
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
                    onClick={() => {
                      handleTestEndpoint();
                    }}>
                    Test Endpoint
                  </Button>
                </div>
              </div>

              <div>
                <Label htmlFor="Triggers">Triggers</Label>
                <div className="border-slate-20 mt-1 rounded-lg border">
                  <div className="grid content-center rounded-lg bg-slate-50 p-3 text-left text-sm text-slate-900">
                    {triggers.map((survey) => (
                      <div key={survey.value} className="my-1 flex items-center space-x-2">
                        <label htmlFor={survey.value} className="flex cursor-pointer items-center">
                          <Checkbox
                            type="button"
                            id={survey.value}
                            value={survey.value}
                            className="bg-white"
                            checked={selectedTriggers.includes(survey.value)}
                            onCheckedChange={() => {
                              handleCheckboxChange(survey.value);
                            }}
                          />
                          <span className="ml-2">{survey.title}</span>
                        </label>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div>
                <Label htmlFor="Surveys">Surveys</Label>
                <div className="mt-1 rounded-lg border border-slate-200">
                  <div className="grid content-center rounded-lg bg-slate-50 p-3 text-left text-sm text-slate-900">
                    <div className="my-1 flex items-center space-x-2">
                      <Checkbox
                        type="button"
                        id="allSurveys"
                        value=""
                        checked={selectedAllSurveys}
                        className="bg-white"
                        onCheckedChange={() => handleSelectAllSurveys()}
                      />
                      <label
                        htmlFor="allSurveys"
                        className={`flex cursor-pointer items-center ${
                          selectedAllSurveys ? "font-semibold" : ""
                        }`}>
                        All current and new surveys
                      </label>
                    </div>
                    {surveys.map((survey) => (
                      <div key={survey.id} className="my-1 flex items-center space-x-2">
                        <Checkbox
                          type="button"
                          id={survey.id}
                          value={survey.id}
                          className="bg-white"
                          checked={selectedSurveys.includes(survey.id) && !selectedAllSurveys}
                          disabled={selectedAllSurveys}
                          onCheckedChange={() => handleSelectedSurveyChange(survey.id)}
                        />
                        <label
                          htmlFor={survey.id}
                          className={`flex cursor-pointer items-center ${
                            selectedAllSurveys ? "cursor-not-allowed opacity-50" : ""
                          }`}>
                          {survey.name}
                        </label>
                      </div>
                    ))}
                  </div>
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
              <Button variant="darkCTA" type="submit" loading={creatingWebhook}>
                Add Webhook
              </Button>
            </div>
          </div>
        </form>
      </div>
    </Modal>
  );
}
