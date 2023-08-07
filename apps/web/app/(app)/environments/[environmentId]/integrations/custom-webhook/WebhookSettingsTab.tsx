"use client";

import DeleteDialog from "@/components/shared/DeleteDialog";
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
import { TrashIcon } from "@heroicons/react/24/outline";
import clsx from "clsx";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "react-hot-toast";
import { TWebhook, TWebhookInput } from "@formbricks/types/v1/webhooks";
import { deleteWebhook, updateWebhook } from "@formbricks/lib/services/webhook";
import { TPipelineTrigger } from "@formbricks/types/v1/pipelines";
import { ChevronDown } from "lucide-react";
import { TSurvey } from "@formbricks/types/v1/surveys";
import { testEndpoint } from "@/app/(app)/environments/[environmentId]/integrations/custom-webhook/testEndpoint";

interface ActionSettingsTabProps {
  environmentId: string;
  webhook: TWebhook;
  surveys: TSurvey[];
  setOpen: (v: boolean) => void;
}

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
          <Label>URL</Label>
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
          <Label>Triggers</Label>
          <div className="flex gap-2">
            <div className="flex items-center space-x-2 rounded-lg border border-slate-200 p-3">
              <Checkbox
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
            <DropdownMenuContent className="w-full bg-slate-50 text-slate-700" align="start" side="bottom">
              {surveys.map((survey) => (
                <DropdownMenuCheckboxItem
                  key={survey.id}
                  checked={selectedSurveys.includes(survey.id)}
                  onCheckedChange={() => handleSelectedSurveyChange(survey.id)}>
                  {survey.name}
                </DropdownMenuCheckboxItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
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

            <Button variant="secondary" href="https://formbricks.com/docs" target="_blank">
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
