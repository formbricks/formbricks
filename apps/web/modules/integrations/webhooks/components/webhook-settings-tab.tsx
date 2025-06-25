"use client";

import { getFormattedErrorMessage } from "@/lib/utils/helper";
import { SurveyCheckboxGroup } from "@/modules/integrations/webhooks/components/survey-checkbox-group";
import { TriggerCheckboxGroup } from "@/modules/integrations/webhooks/components/trigger-checkbox-group";
import { validWebHookURL } from "@/modules/integrations/webhooks/lib/utils";
import { Button } from "@/modules/ui/components/button";
import { DeleteDialog } from "@/modules/ui/components/delete-dialog";
import { Input } from "@/modules/ui/components/input";
import { Label } from "@/modules/ui/components/label";
import { PipelineTriggers, Webhook } from "@prisma/client";
import { useTranslate } from "@tolgee/react";
import clsx from "clsx";
import { TrashIcon } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "react-hot-toast";
import { TSurvey } from "@formbricks/types/surveys/types";
import { deleteWebhookAction, testEndpointAction, updateWebhookAction } from "../actions";
import { TWebhookInput } from "../types/webhooks";

interface WebhookSettingsTabProps {
  webhook: Webhook;
  surveys: TSurvey[];
  setOpen: (v: boolean) => void;
  isReadOnly: boolean;
}

export const WebhookSettingsTab = ({ webhook, surveys, setOpen, isReadOnly }: WebhookSettingsTabProps) => {
  const { t } = useTranslate();
  const router = useRouter();
  const { register, handleSubmit } = useForm({
    defaultValues: {
      name: webhook.name,
      url: webhook.url,
      triggers: webhook.triggers,
      surveyIds: webhook.surveyIds,
    },
  });

  const [openDeleteDialog, setOpenDeleteDialog] = useState(false);
  const [isUpdatingWebhook, setIsUpdatingWebhook] = useState(false);
  const [selectedTriggers, setSelectedTriggers] = useState<PipelineTriggers[]>(webhook.triggers);
  const [selectedSurveys, setSelectedSurveys] = useState<string[]>(webhook.surveyIds);
  const [testEndpointInput, setTestEndpointInput] = useState(webhook.url);
  const [endpointAccessible, setEndpointAccessible] = useState<boolean>();
  const [hittingEndpoint, setHittingEndpoint] = useState<boolean>(false);
  const [selectedAllSurveys, setSelectedAllSurveys] = useState(webhook.surveyIds.length === 0);

  const handleTestEndpoint = async (sendSuccessToast: boolean) => {
    try {
      const { valid, error } = validWebHookURL(testEndpointInput);
      if (!valid) {
        toast.error(error ?? t("common.something_went_wrong_please_try_again"));
        return;
      }
      setHittingEndpoint(true);
      const testEndpointActionResult = await testEndpointAction({ url: testEndpointInput });
      if (!testEndpointActionResult?.data) {
        const errorMessage = getFormattedErrorMessage(testEndpointActionResult);
        throw new Error(errorMessage);
      }
      setHittingEndpoint(false);
      if (sendSuccessToast) toast.success(t("environments.integrations.webhooks.endpoint_pinged"));
      setEndpointAccessible(true);
      return true;
    } catch (err) {
      setHittingEndpoint(false);
      toast.error(
        `${t("environments.integrations.webhooks.endpoint_pinged_error")} \n ${err.message.length < 250 ? `${t("common.error")}:  ${err.message}` : t("environments.integrations.webhooks.please_check_console")}`,
        { className: err.message.length < 250 ? "break-all" : "" }
      );
      console.error(t("environments.integrations.webhooks.webhook_test_failed_due_to"), err.message);
      setEndpointAccessible(false);
      return false;
    }
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

  const onSubmit = async (data) => {
    if (selectedTriggers.length === 0) {
      toast.error(t("common.please_select_at_least_one_trigger"));
      return;
    }

    if (!selectedAllSurveys && selectedSurveys.length === 0) {
      toast.error(t("common.please_select_at_least_one_survey"));
      return;
    }
    const endpointHitSuccessfully = await handleTestEndpoint(false);
    if (!endpointHitSuccessfully) {
      return;
    }

    const updatedData: TWebhookInput = {
      name: data.name,
      url: data.url as string,
      source: data.source,
      triggers: selectedTriggers,
      surveyIds: selectedSurveys,
    };
    setIsUpdatingWebhook(true);
    const updateWebhookActionResult = await updateWebhookAction({
      webhookId: webhook.id,
      webhookInput: updatedData,
    });
    if (updateWebhookActionResult?.data) {
      router.refresh();
      toast.success(t("environments.integrations.webhooks.webhook_updated_successfully"));
    } else {
      const errorMessage = getFormattedErrorMessage(updateWebhookActionResult);
      toast.error(errorMessage);
    }
    setIsUpdatingWebhook(false);
    setOpen(false);
  };

  return (
    <div>
      <form className="space-y-4" onSubmit={handleSubmit(onSubmit)}>
        <div className="col-span-1">
          <Label htmlFor="Name">{t("common.name")}</Label>
          <div className="mt-1 flex">
            <Input
              type="text"
              id="name"
              {...register("name")}
              disabled={isReadOnly}
              defaultValue={webhook.name ?? ""}
              placeholder={t("environments.integrations.webhooks.webhook_name_placeholder")}
            />
          </div>
        </div>

        <div className="col-span-1">
          <Label htmlFor="URL">{t("common.url")}</Label>
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
              readOnly={webhook.source !== "user"}
              className={clsx(
                webhook.source === "user" ? null : "cursor-not-allowed bg-slate-100 text-slate-500",
                endpointAccessible === true
                  ? "border-green-500 bg-green-50"
                  : endpointAccessible === false
                    ? "border-red-200 bg-red-50"
                    : endpointAccessible === undefined
                      ? "border-slate-200 bg-white"
                      : null
              )}
              placeholder={t("environments.integrations.webhooks.webhook_url_placeholder")}
            />
            <Button
              type="button"
              variant="secondary"
              loading={hittingEndpoint}
              className="ml-2 whitespace-nowrap"
              onClick={() => {
                handleTestEndpoint(true);
              }}>
              {t("environments.integrations.webhooks.test_endpoint")}
            </Button>
          </div>
        </div>

        <div>
          <Label htmlFor="Triggers">{t("environments.integrations.webhooks.triggers")}</Label>
          <TriggerCheckboxGroup
            selectedTriggers={selectedTriggers}
            onCheckboxChange={handleCheckboxChange}
            allowChanges={webhook.source === "user" && !isReadOnly}
          />
        </div>

        <div>
          <Label htmlFor="Surveys">{t("common.surveys")}</Label>
          <SurveyCheckboxGroup
            surveys={surveys}
            selectedSurveys={selectedSurveys}
            selectedAllSurveys={selectedAllSurveys}
            onSelectAllSurveys={handleSelectAllSurveys}
            onSelectedSurveyChange={handleSelectedSurveyChange}
            allowChanges={webhook.source === "user" && !isReadOnly}
          />
        </div>

        <div className="flex justify-between border-t border-slate-200 py-6">
          <div>
            {!isReadOnly && (
              <Button
                type="button"
                variant="destructive"
                onClick={() => setOpenDeleteDialog(true)}
                className="mr-3">
                <TrashIcon />
                {t("common.delete")}
              </Button>
            )}

            <Button variant="secondary" asChild>
              <Link href="https://formbricks.com/docs/api/management/webhooks" target="_blank">
                {t("common.read_docs")}
              </Link>
            </Button>
          </div>

          {!isReadOnly && (
            <div className="flex space-x-2">
              <Button type="submit" loading={isUpdatingWebhook}>
                {t("common.save_changes")}
              </Button>
            </div>
          )}
        </div>
      </form>
      <DeleteDialog
        open={openDeleteDialog}
        setOpen={setOpenDeleteDialog}
        deleteWhat={t("common.webhook")}
        text={t("environments.integrations.webhooks.webhook_delete_confirmation")}
        onDelete={async () => {
          setOpen(false);
          const deleteWebhookActionResult = await deleteWebhookAction({ id: webhook.id });
          if (deleteWebhookActionResult?.data) {
            router.refresh();
            toast.success(t("environments.integrations.webhooks.webhook_deleted_successfully"));
          } else {
            const errorMessage = getFormattedErrorMessage(deleteWebhookActionResult);
            toast.error(errorMessage);
          }
        }}
      />
    </div>
  );
};
