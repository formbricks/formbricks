"use client";

import { createOrUpdateIntegrationAction } from "@/app/(app)/environments/[environmentId]/integrations/actions";
import SlackLogo from "@/images/slacklogo.png";
import { getLocalizedValue } from "@/lib/i18n/utils";
import { replaceHeadlineRecall } from "@/lib/utils/recall";
import { AdditionalIntegrationSettings } from "@/modules/ui/components/additional-integration-settings";
import { Button } from "@/modules/ui/components/button";
import { Checkbox } from "@/modules/ui/components/checkbox";
import { DropdownSelector } from "@/modules/ui/components/dropdown-selector";
import { Label } from "@/modules/ui/components/label";
import { Modal } from "@/modules/ui/components/modal";
import { useTranslate } from "@tolgee/react";
import { CircleHelpIcon } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import toast from "react-hot-toast";
import { TIntegrationItem } from "@formbricks/types/integration";
import {
  TIntegrationSlack,
  TIntegrationSlackConfigData,
  TIntegrationSlackInput,
} from "@formbricks/types/integration/slack";
import { TSurvey, TSurveyQuestionId } from "@formbricks/types/surveys/types";

interface AddChannelMappingModalProps {
  environmentId: string;
  surveys: TSurvey[];
  open: boolean;
  setOpen: (v: boolean) => void;
  slackIntegration: TIntegrationSlack;
  channels: TIntegrationItem[];
  selectedIntegration?: (TIntegrationSlackConfigData & { index: number }) | null;
}

export const AddChannelMappingModal = ({
  environmentId,
  surveys,
  open,
  setOpen,
  channels,
  slackIntegration,
  selectedIntegration,
}: AddChannelMappingModalProps) => {
  const { handleSubmit } = useForm();
  const { t } = useTranslate();
  const [selectedQuestions, setSelectedQuestions] = useState<string[]>([]);
  const [isLinkingChannel, setIsLinkingChannel] = useState(false);
  const [selectedSurvey, setSelectedSurvey] = useState<TSurvey | null>(null);
  const [selectedChannel, setSelectedChannel] = useState<TIntegrationItem | null>(null);
  const [isDeleting, setIsDeleting] = useState<boolean>(false);
  const [includeVariables, setIncludeVariables] = useState(false);
  const [includeHiddenFields, setIncludeHiddenFields] = useState(false);
  const [includeMetadata, setIncludeMetadata] = useState(false);
  const [includeCreatedAt, setIncludeCreatedAt] = useState(true);
  const existingIntegrationData = slackIntegration?.config?.data;
  const slackIntegrationData: TIntegrationSlackInput = {
    type: "slack",
    config: {
      key: slackIntegration?.config?.key,
      data: existingIntegrationData || [],
    },
  };

  useEffect(() => {
    if (selectedSurvey) {
      const questionIds = selectedSurvey.questions.map((question) => question.id);
      if (!selectedIntegration) {
        setSelectedQuestions(questionIds);
      }
    }
  }, [selectedIntegration, selectedSurvey]);

  useEffect(() => {
    if (selectedIntegration) {
      setSelectedChannel({
        id: selectedIntegration.channelId,
        name: selectedIntegration.channelName,
      });
      setSelectedSurvey(
        surveys.find((survey) => {
          return survey.id === selectedIntegration.surveyId;
        })!
      );
      setSelectedQuestions(selectedIntegration.questionIds);
      setIncludeVariables(!!selectedIntegration.includeVariables);
      setIncludeHiddenFields(!!selectedIntegration.includeHiddenFields);
      setIncludeMetadata(!!selectedIntegration.includeMetadata);
      setIncludeCreatedAt(!!selectedIntegration.includeCreatedAt);
      return;
    }
    resetForm();
  }, [selectedIntegration, surveys]);

  const linkChannel = async () => {
    try {
      if (!selectedChannel) {
        throw new Error(t("environments.integrations.slack.please_select_a_channel"));
      }
      if (!selectedSurvey) {
        throw new Error(t("environments.integrations.please_select_a_survey_error"));
      }

      if (selectedQuestions.length === 0) {
        throw new Error(t("environments.integrations.select_at_least_one_question_error"));
      }
      setIsLinkingChannel(true);
      const integrationData: TIntegrationSlackConfigData = {
        channelId: selectedChannel.id,
        channelName: selectedChannel.name,
        surveyId: selectedSurvey.id,
        surveyName: selectedSurvey.name,
        questionIds: selectedQuestions,
        questions:
          selectedQuestions.length === selectedSurvey?.questions.length
            ? t("common.all_questions")
            : t("common.selected_questions"),
        createdAt: new Date(),
        includeVariables,
        includeHiddenFields,
        includeMetadata,
        includeCreatedAt,
      };
      if (selectedIntegration) {
        // update action
        slackIntegrationData.config!.data[selectedIntegration.index] = integrationData;
      } else {
        // create action
        slackIntegrationData.config!.data.push(integrationData);
      }
      await createOrUpdateIntegrationAction({ environmentId, integrationData: slackIntegrationData });
      if (selectedIntegration) {
        toast.success(t("environments.integrations.integration_updated_successfully"));
      } else {
        toast.success(t("environments.integrations.integration_added_successfully"));
      }
      resetForm();
      setOpen(false);
    } catch (e) {
      toast.error(e.message);
    } finally {
      setIsLinkingChannel(false);
    }
  };

  const handleCheckboxChange = (questionId: TSurveyQuestionId) => {
    setSelectedQuestions((prevValues) =>
      prevValues.includes(questionId)
        ? prevValues.filter((value) => value !== questionId)
        : [...prevValues, questionId]
    );
  };

  const setOpenWithStates = (isOpen: boolean) => {
    setOpen(isOpen);
  };

  const resetForm = () => {
    setIsLinkingChannel(false);
    setSelectedChannel(null);
    setSelectedSurvey(null);
  };

  const deleteLink = async () => {
    slackIntegrationData.config!.data.splice(selectedIntegration!.index, 1);
    try {
      setIsDeleting(true);
      await createOrUpdateIntegrationAction({ environmentId, integrationData: slackIntegrationData });
      toast.success(t("environments.integrations.integration_removed_successfully"));
      setOpen(false);
    } catch (error) {
      toast.error(error.message);
    } finally {
      setIsDeleting(false);
    }
  };

  const hasMatchingId = useMemo(
    () =>
      slackIntegration.config.data.some((configData) => {
        if (!selectedChannel) {
          return false;
        }
        return configData.channelId === selectedChannel.id && !selectedIntegration;
      }),
    [selectedChannel, selectedIntegration, slackIntegration.config.data]
  );

  return (
    <Modal open={open} setOpen={setOpenWithStates} noPadding closeOnOutsideClick={true}>
      <div className="flex h-full flex-col rounded-lg">
        <div className="rounded-t-lg bg-slate-100">
          <div className="flex w-full items-center justify-between p-6">
            <div className="flex items-center space-x-2">
              <div className="mr-1.5 h-6 w-6 text-slate-500">
                <Image className="w-12" src={SlackLogo} alt="Slack logo" />
              </div>
              <div>
                <div className="text-xl font-medium text-slate-700">
                  {t("environments.integrations.slack.link_slack_channel")}
                </div>
              </div>
            </div>
          </div>
        </div>
        <form onSubmit={handleSubmit(linkChannel)}>
          <div className="flex justify-between rounded-lg p-6">
            <div className="w-full space-y-4">
              <div>
                <div className="mb-4">
                  <DropdownSelector
                    label={t("environments.integrations.slack.select_channel")}
                    items={channels}
                    selectedItem={selectedChannel}
                    setSelectedItem={setSelectedChannel}
                    disabled={channels.length === 0}
                  />
                  <Link
                    href="https://formbricks.com/docs/developer-docs/integrations/slack"
                    target="_blank"
                    className="text-xs">
                    <Button variant="ghost" size="sm" className="my-2" type="button">
                      <CircleHelpIcon className="h-4 w-4" />
                      {t("environments.integrations.slack.dont_see_your_channel")}
                    </Button>
                  </Link>
                  {selectedChannel && hasMatchingId && (
                    <p className="text-xs text-amber-700">
                      <strong>{t("common.note")}:</strong>{" "}
                      {t("environments.integrations.slack.already_connected_another_survey")}
                    </p>
                  )}
                  <p className="m-1 text-xs text-slate-500">
                    {channels.length === 0 &&
                      t("environments.integrations.slack.create_at_least_one_channel_error")}
                  </p>
                </div>
                <div>
                  <DropdownSelector
                    label={t("common.select_survey")}
                    items={surveys}
                    selectedItem={selectedSurvey}
                    setSelectedItem={setSelectedSurvey}
                    disabled={surveys.length === 0}
                  />
                  <p className="m-1 text-xs text-slate-500">
                    {surveys.length === 0 && t("environments.integrations.create_survey_warning")}
                  </p>
                </div>
              </div>
              {selectedSurvey && (
                <div>
                  <div>
                    <Label htmlFor="Surveys">{t("common.questions")}</Label>
                    <div className="mt-1 max-h-[15vh] overflow-y-auto rounded-lg border border-slate-200">
                      <div className="grid content-center rounded-lg bg-slate-50 p-3 text-left text-sm text-slate-900">
                        {replaceHeadlineRecall(selectedSurvey, "default")?.questions?.map((question) => (
                          <div key={question.id} className="my-1 flex items-center space-x-2">
                            <label htmlFor={question.id} className="flex cursor-pointer items-center">
                              <Checkbox
                                type="button"
                                id={question.id}
                                value={question.id}
                                className="bg-white"
                                checked={selectedQuestions.includes(question.id)}
                                onCheckedChange={() => {
                                  handleCheckboxChange(question.id);
                                }}
                              />
                              <span className="ml-2">{getLocalizedValue(question.headline, "default")}</span>
                            </label>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                  <AdditionalIntegrationSettings
                    includeVariables={includeVariables}
                    setIncludeVariables={setIncludeVariables}
                    includeHiddenFields={includeHiddenFields}
                    includeMetadata={includeMetadata}
                    setIncludeHiddenFields={setIncludeHiddenFields}
                    setIncludeMetadata={setIncludeMetadata}
                    includeCreatedAt={includeCreatedAt}
                    setIncludeCreatedAt={setIncludeCreatedAt}
                  />
                </div>
              )}
            </div>
          </div>
          <div className="flex justify-end border-t border-slate-200 p-6">
            <div className="flex space-x-2">
              {selectedIntegration ? (
                <Button type="button" variant="destructive" loading={isDeleting} onClick={deleteLink}>
                  {t("common.delete")}
                </Button>
              ) : (
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => {
                    setOpen(false);
                    resetForm();
                  }}>
                  {t("common.cancel")}
                </Button>
              )}
              <Button type="submit" loading={isLinkingChannel}>
                {selectedIntegration ? t("common.update") : t("environments.integrations.slack.link_channel")}
              </Button>
            </div>
          </div>
        </form>
      </div>
    </Modal>
  );
};
