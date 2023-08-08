"use client";

import Modal from "@/components/shared/Modal";
import {
  Button,
  Checkbox,
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
  Input,
  Label,
} from "@formbricks/ui";
import clsx from "clsx";
import { useState } from "react";
import { useForm } from "react-hook-form";
import toast from "react-hot-toast";
import { useRouter } from "next/navigation";
import { TSurvey } from "@formbricks/types/v1/surveys";
import { ChevronDown, Webhook } from "lucide-react";
import { TWebhookInput } from "@formbricks/types/v1/webhooks";
import { TPipelineTrigger } from "@formbricks/types/v1/pipelines";
import { createWebhook } from "@formbricks/lib/services/webhook";
import { testEndpoint } from "@/app/(app)/environments/[environmentId]/integrations/custom-webhook/testEndpoint";

interface AddWebhookModalProps {
  environmentId: string;
  open: boolean;
  surveys: TSurvey[];
  setOpen: (v: boolean) => void;
}

export default function AddWebhookModal({ environmentId, surveys, open, setOpen }: AddWebhookModalProps) {
  const router = useRouter();
  const { handleSubmit, reset } = useForm();

  const submitWebhook = async (): Promise<void> => {
    if (testEndpointInput === undefined || testEndpointInput === "") {
      toast.error("Please enter a URL");
      return;
    }

    if (selectedTriggers.length === 0) {
      toast.error("Please select at least one trigger");
      return;
    }

    const updatedData: TWebhookInput = {
      url: testEndpointInput,
      triggers: selectedTriggers,
      surveyIds: selectedSurveys,
    };
    try {
      await createWebhook(environmentId, updatedData);
      router.refresh();
      reset();
      setOpen(false);
      toast.success("Webhook added successfully.");
    } catch (e) {
      toast.error(e.message);
      return;
    }
  };
  const renderSelectedSurveysText = () => {
    if (selectedSurveys.length === 0) {
      return <p className="text-slate-400">Select Surveys for this webhook</p>;
    } else {
      const selectedSurveyNames = selectedSurveys.map((surveyId) => {
        const survey = surveys.find((survey) => survey.id === surveyId);
        return survey ? survey.name : "";
      });
      return <p className="text-slate-400">{selectedSurveyNames.join(", ")}</p>;
    }
  };
  const [testEndpointInput, setTestEndpointInput] = useState("");
  const [endpointAccessible, setEndpointAccessible] = useState<boolean>();
  const [hittingEndpoint, setHittingEndpoint] = useState<boolean>(false);

  const [selectedSurveys, setSelectedSurveys] = useState<string[]>([]);
  const [selectedTriggers, setSelectedTriggers] = useState<TPipelineTrigger[]>([]);

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
    } catch (err) {
      setHittingEndpoint(false);
      toast.error("Oh no! We are unable to ping the webhook!");
      setEndpointAccessible(false);
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
                <Label>URL</Label>
                <div className="mt-1 flex">
                  <Input
                    type="text"
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
                <Label>Triggers</Label>
                <div className="flex gap-2">
                  <div className="flex items-center space-x-2 rounded-lg border border-slate-200 p-3">
                    <Checkbox
                      key={"responseCreated"}
                      value="responseCreated"
                      checked={selectedTriggers.includes("responseCreated")}
                      onCheckedChange={() => {
                        handleCheckboxChange("responseCreated");
                      }}
                    />
                    <Label className="flex cursor-pointer items-center">Response Created</Label>
                  </div>
                  <div className="flex items-center space-x-2 rounded-lg border border-slate-200 p-3">
                    <Checkbox
                      key={"responseUpdated"}
                      value="responseUpdated"
                      checked={selectedTriggers.includes("responseUpdated")}
                      onCheckedChange={() => {
                        handleCheckboxChange("responseUpdated");
                      }}
                    />
                    <Label className="flex cursor-pointer items-center">Response Updated</Label>
                  </div>
                  <div className="flex items-center space-x-2 rounded-lg border border-slate-200 p-3">
                    <Checkbox
                      key={"responseFinished"}
                      value="responseFinished"
                      checked={selectedTriggers.includes("responseFinished")}
                      onCheckedChange={() => {
                        handleCheckboxChange("responseFinished");
                      }}
                    />
                    <Label className="flex cursor-pointer items-center">Response Finished</Label>
                  </div>
                </div>
              </div>

              <div>
                <Label>Surveys to enable</Label>

                <DropdownMenu>
                  <DropdownMenuTrigger className="z-10 cursor-pointer" asChild>
                    <div className="flex h-10 w-full items-center justify-between rounded-md border border-slate-300 bg-transparent px-3 py-2 text-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-400 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 ">
                      {renderSelectedSurveysText()}
                      <ChevronDown className="h-4 w-4 opacity-50" />
                    </div>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent
                    className="w-full bg-slate-50 text-slate-700"
                    align="start"
                    side="bottom">
                    {surveys.map((survey) => (
                      <DropdownMenuCheckboxItem
                        key={survey.id}
                        checked={selectedSurveys.includes(survey.id)}
                        onSelect={(e) => e.preventDefault()}
                        onCheckedChange={() => handleSelectedSurveyChange(survey.id)}>
                        {survey.name}
                      </DropdownMenuCheckboxItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
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
              <Button variant="darkCTA" type="submit">
                Add Webhook
              </Button>
            </div>
          </div>
        </form>
      </div>
    </Modal>
  );
}
