"use client";

import { CircleHelpIcon } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import toast from "react-hot-toast";
import { useTranslation } from "react-i18next";
import { TIntegrationItem } from "@formbricks/types/integration";
import {
  TIntegrationSlack,
  TIntegrationSlackConfigData,
  TIntegrationSlackInput,
} from "@formbricks/types/integration/slack";
import { TSurvey } from "@formbricks/types/surveys/types";
import { getTextContent } from "@formbricks/types/surveys/validation";
import { createOrUpdateIntegrationAction } from "@/app/(app)/environments/[environmentId]/project/integrations/actions";
import SlackLogo from "@/images/slacklogo.png";
import { recallToHeadline } from "@/lib/utils/recall";
import { getElementsFromBlocks } from "@/modules/survey/lib/client-utils";
import { AdditionalIntegrationSettings } from "@/modules/ui/components/additional-integration-settings";
import { Button } from "@/modules/ui/components/button";
import { Checkbox } from "@/modules/ui/components/checkbox";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/modules/ui/components/dialog";
import { DropdownSelector } from "@/modules/ui/components/dropdown-selector";
import { Label } from "@/modules/ui/components/label";

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
  const { t } = useTranslation();
  const [selectedElements, setSelectedElements] = useState<string[]>([]);
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

  const surveyElements = useMemo(
    () => (selectedSurvey ? getElementsFromBlocks(selectedSurvey.blocks) : []),
    [selectedSurvey]
  );

  useEffect(() => {
    if (selectedSurvey) {
      const elementIds = surveyElements.map((element) => element.id);
      if (!selectedIntegration) {
        setSelectedElements(elementIds);
      }
    }
  }, [surveyElements, selectedIntegration, selectedSurvey]);

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
      setSelectedElements(selectedIntegration.elementIds);
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

      if (selectedElements.length === 0) {
        throw new Error(t("environments.integrations.select_at_least_one_question_error"));
      }
      setIsLinkingChannel(true);
      const integrationData: TIntegrationSlackConfigData = {
        channelId: selectedChannel.id,
        channelName: selectedChannel.name,
        surveyId: selectedSurvey.id,
        surveyName: selectedSurvey.name,
        elementIds: selectedElements,
        elements:
          selectedElements.length === surveyElements.length
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
        slackIntegrationData.config.data[selectedIntegration.index] = integrationData;
      } else {
        // create action
        slackIntegrationData.config.data.push(integrationData);
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

  const handleCheckboxChange = (elementId: string) => {
    setSelectedElements((prevValues) =>
      prevValues.includes(elementId)
        ? prevValues.filter((value) => value !== elementId)
        : [...prevValues, elementId]
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
    slackIntegrationData.config.data.splice(selectedIntegration!.index, 1);
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
    <Dialog open={open} onOpenChange={setOpenWithStates}>
      <DialogContent>
        <DialogHeader>
          <div className="flex items-center space-x-2">
            <div className="relative size-8">
              <Image
                fill
                className="object-contain object-center"
                src={SlackLogo}
                alt={t("environments.integrations.slack.slack_logo")}
              />
            </div>
            <div className="space-y-0.5">
              <DialogTitle>{t("environments.integrations.slack.link_slack_channel")}</DialogTitle>
              <DialogDescription>
                {t("environments.integrations.slack.slack_integration_description")}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>
        <form className="space-y-4" onSubmit={handleSubmit(linkChannel)}>
          <DialogBody>
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
                        {surveyElements.map((element) => (
                          <div key={element.id} className="my-1 flex items-center space-x-2">
                            <label htmlFor={element.id} className="flex cursor-pointer items-center">
                              <Checkbox
                                type="button"
                                id={element.id}
                                value={element.id}
                                className="bg-white"
                                checked={selectedElements.includes(element.id)}
                                onCheckedChange={() => {
                                  handleCheckboxChange(element.id);
                                }}
                              />
                              <span className="ml-2">
                                {getTextContent(
                                  recallToHeadline(element.headline, selectedSurvey, false, "default")[
                                    "default"
                                  ]
                                )}
                              </span>
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
          </DialogBody>
          <DialogFooter>
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
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
