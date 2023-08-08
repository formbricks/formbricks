"use client";

import DeleteDialog from "@/components/shared/DeleteDialog";
import { Button, Checkbox, Input, Label } from "@formbricks/ui";
import { TrashIcon } from "@heroicons/react/24/outline";
import clsx from "clsx";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "react-hot-toast";
import { TWebhook, TWebhookInput } from "@formbricks/types/v1/webhooks";
import { deleteWebhook, updateWebhook } from "@formbricks/lib/services/webhook";
import { TPipelineTrigger } from "@formbricks/types/v1/pipelines";
import { TSurvey } from "@formbricks/types/v1/surveys";
import { testEndpoint } from "@/app/(app)/environments/[environmentId]/integrations/custom-webhook/testEndpoint";

interface ActionSettingsTabProps {
  environmentId: string;
  webhook: TWebhook;
  surveys: TSurvey[];
  setOpen: (v: boolean) => void;
}

const triggers = [
  { title: "Response Created", value: "responseCreated" as TPipelineTrigger },
  { title: "Response Updated", value: "responseUpdated" as TPipelineTrigger },
  { title: "Response Finished", value: "responseFinished" as TPipelineTrigger },
];

export default function WebhookSettingsTab({
  environmentId,
  webhook,
  surveys,
  setOpen,
}: ActionSettingsTabProps) {
  const router = useRouter();
  const [openDeleteDialog, setOpenDeleteDialog] = useState(false);
  const [isUpdatingWebhook, setIsUpdatingWebhook] = useState(false);
  const [selectedTriggers, setSelectedTriggers] = useState<TPipelineTrigger[]>(webhook.triggers);
  const [selectedSurveys, setSelectedSurveys] = useState<string[]>(webhook.surveyIds);
  const [testEndpointInput, setTestEndpointInput] = useState(webhook.url);
  const [endpointAccessible, setEndpointAccessible] = useState<boolean>();
  const [hittingEndpoint, setHittingEndpoint] = useState<boolean>(false);
  const [selectedAllSurveys, setSelectedAllSurveys] = useState(webhook.surveyIds.length === 0);

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

  const handleSelectAllSurveys = () => {
    setSelectedAllSurveys(!selectedAllSurveys);
    setSelectedSurveys([]);
  };

  const { register, handleSubmit } = useForm({
    defaultValues: {
      url: webhook.url,
      triggers: webhook.triggers,
      surveyIds: webhook.surveyIds,
    },
  });

  const onSubmit = async (data) => {
    if (selectedTriggers.length === 0) {
      toast.error("Please select at least one trigger");
      return;
    }
    const updatedData: TWebhookInput = {
      url: data.url as string,
      triggers: selectedTriggers,
      surveyIds: selectedSurveys,
    };
    setIsUpdatingWebhook(true);
    await updateWebhook(environmentId, webhook.id, updatedData);
    router.refresh();
    setIsUpdatingWebhook(false);
    setOpen(false);
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

  return (
    <div>
      <form className="space-y-4" onSubmit={handleSubmit(onSubmit)}>
        <div className="col-span-1">
          <Label htmlFor="URL">URL</Label>
          <div className="mt-1 flex">
            <Input
              {...register("url", {
                value: testEndpointInput,
              })}
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
          <Label htmlFor="Triggers">Triggers</Label>
          <div className="mt-1 rounded-lg border border-slate-200">
            <div className="grid content-center rounded-lg bg-slate-100 p-3 text-left text-sm text-slate-900">
              {triggers.map((survey) => (
                <div key={survey.value} className="my-1 flex items-center space-x-2">
                  <label htmlFor={survey.value} className="flex cursor-pointer items-center">
                    <Checkbox
                      type="button"
                      id={survey.value}
                      value={survey.value}
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
            <div className="grid content-center rounded-lg bg-slate-100 p-3 text-left text-sm text-slate-900">
              <div className="my-1 flex items-center space-x-2">
                <Checkbox
                  type="button"
                  id="allSurveys"
                  value=""
                  checked={selectedAllSurveys}
                  onCheckedChange={() => handleSelectAllSurveys()}
                />
                <label
                  htmlFor="allSurveys"
                  className={`flex cursor-pointer items-center ${selectedAllSurveys ? "font-semibold" : ""}`}>
                  All current and new surveys
                </label>
              </div>
              {surveys.map((survey) => (
                <div key={survey.id} className="my-1 flex items-center space-x-2">
                  <Checkbox
                    type="button"
                    id={survey.id}
                    value={survey.id}
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

        <div className="flex justify-between border-t border-slate-200 py-6">
          <div>
            <Button
              type="button"
              variant="warn"
              onClick={() => setOpenDeleteDialog(true)}
              StartIcon={TrashIcon}
              className="mr-3">
              Delete
            </Button>

            <Button
              variant="secondary"
              href="https://formbricks.com/docs/webhook-api/overview"
              target="_blank">
              Read Docs
            </Button>
          </div>

          <div className="flex space-x-2">
            <Button type="submit" variant="darkCTA" loading={isUpdatingWebhook}>
              Save changes
            </Button>
          </div>
        </div>
      </form>
      <DeleteDialog
        open={openDeleteDialog}
        setOpen={setOpenDeleteDialog}
        deleteWhat={"Webhook"}
        text="Are you sure you want to delete this Webhook? This will stop sending you any further notifications."
        onDelete={async () => {
          setOpen(false);
          try {
            await deleteWebhook(webhook.id);
            router.refresh();
            toast.success("Webhook deleted successfully");
          } catch (error) {
            toast.error("Something went wrong. Please try again.");
          }
        }}
      />
    </div>
  );
}
