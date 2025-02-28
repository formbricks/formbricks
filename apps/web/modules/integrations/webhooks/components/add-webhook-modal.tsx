"use client";

import { getFormattedErrorMessage } from "@/lib/utils/helper";
import { SurveyCheckboxGroup } from "@/modules/integrations/webhooks/components/survey-checkbox-group";
import { TriggerCheckboxGroup } from "@/modules/integrations/webhooks/components/trigger-checkbox-group";
import { isDiscordWebhook, validWebHookURL } from "@/modules/integrations/webhooks/lib/utils";
import { Button } from "@/modules/ui/components/button";
import { Input } from "@/modules/ui/components/input";
import { Label } from "@/modules/ui/components/label";
import { Modal } from "@/modules/ui/components/modal";
import { PipelineTriggers } from "@prisma/client";
import { useTranslate } from "@tolgee/react";
import clsx from "clsx";
import { Webhook } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import toast from "react-hot-toast";
import { TSurvey } from "@formbricks/types/surveys/types";
import { createWebhookAction, testEndpointAction } from "../actions";
import { TWebhookInput } from "../types/webhooks";

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
  const { t } = useTranslate();
  const [testEndpointInput, setTestEndpointInput] = useState("");
  const [hittingEndpoint, setHittingEndpoint] = useState<boolean>(false);
  const [endpointAccessible, setEndpointAccessible] = useState<boolean>();
  const [selectedTriggers, setSelectedTriggers] = useState<PipelineTriggers[]>([]);
  const [selectedSurveys, setSelectedSurveys] = useState<string[]>([]);
  const [selectedAllSurveys, setSelectedAllSurveys] = useState(false);
  const [creatingWebhook, setCreatingWebhook] = useState(false);

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
        `${t("environments.integrations.webhooks.endpoint_pinged_error")} \n ${
          err.message.length < 250
            ? `${t("common.error")}:  ${err.message}`
            : t("environments.integrations.webhooks.please_check_console")
        }`,
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

  const handleSelectedSurveyChange = (surveyId: string) => {
    setSelectedSurveys((prevSelectedSurveys: string[]) =>
      prevSelectedSurveys.includes(surveyId)
        ? prevSelectedSurveys.filter((id) => id !== surveyId)
        : [...prevSelectedSurveys, surveyId]
    );
  };

  const handleCheckboxChange = (selectedValue: PipelineTriggers) => {
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
          throw new Error(t("environments.integrations.webhooks.please_enter_a_url"));
        }
        if (selectedTriggers.length === 0) {
          throw new Error(t("common.please_select_at_least_one_trigger"));
        }

        if (!selectedAllSurveys && selectedSurveys.length === 0) {
          throw new Error(t("common.please_select_at_least_one_survey"));
        }

        if (isDiscordWebhook(testEndpointInput)) {
          throw new Error(t("environments.integrations.webhooks.discord_webhook_not_supported"));
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

        const createWebhookActionResult = await createWebhookAction({
          environmentId,
          webhookInput: updatedData,
        });
        if (createWebhookActionResult?.data) {
          router.refresh();
          setOpenWithStates(false);
          toast.success(t("environments.integrations.webhooks.webhook_added_successfully"));
        } else {
          const errorMessage = getFormattedErrorMessage(createWebhookActionResult);
          toast.error(errorMessage);
        }
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
                <div className="text-xl font-medium text-slate-700">
                  {t("environments.integrations.webhooks.add_webhook")}
                </div>
                <div className="text-sm text-slate-500">
                  {t("environments.integrations.webhooks.add_webhook_description")}
                </div>
              </div>
            </div>
          </div>
        </div>
        <form onSubmit={handleSubmit(submitWebhook)}>
          <div className="flex justify-between rounded-lg p-6">
            <div className="w-full space-y-4">
              <div className="col-span-1">
                <Label htmlFor="name">{t("common.name")}</Label>
                <div className="mt-1 flex">
                  <Input
                    type="text"
                    id="name"
                    {...register("name")}
                    placeholder={t("environments.integrations.webhooks.webhook_name_placeholder")}
                  />
                </div>
              </div>

              <div className="col-span-1">
                <Label htmlFor="URL">{t("common.url")}</Label>
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
                    placeholder={t("environments.integrations.webhooks.webhook_url_placeholder")}
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
                    {t("environments.integrations.webhooks.test_endpoint")}
                  </Button>
                </div>
              </div>

              <div>
                <Label htmlFor="Triggers">{t("environments.integrations.webhooks.triggers")}</Label>
                <TriggerCheckboxGroup
                  selectedTriggers={selectedTriggers}
                  onCheckboxChange={handleCheckboxChange}
                  allowChanges={true}
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
                  allowChanges={true}
                />
              </div>
            </div>
          </div>
          <div className="flex justify-end border-t border-slate-200 p-6">
            <div className="flex space-x-2">
              <Button
                type="button"
                variant="ghost"
                onClick={() => {
                  setOpenWithStates(false);
                }}>
                {t("common.cancel")}
              </Button>
              <Button type="submit" loading={creatingWebhook}>
                {t("environments.integrations.webhooks.add_webhook")}
              </Button>
            </div>
          </div>
        </form>
      </div>
    </Modal>
  );
};
