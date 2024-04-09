import SlackLogo from "@/images/slacklogo.png";
import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import toast from "react-hot-toast";

import { getLocalizedValue } from "@formbricks/lib/i18n/utils";
import { checkForRecallInHeadline } from "@formbricks/lib/utils/recall";
import { TIntegrationItem } from "@formbricks/types/integration";
import {
  TIntegrationSlack,
  TIntegrationSlackConfigData,
  TIntegrationSlackInput,
} from "@formbricks/types/integration/slack";
import { TSurvey } from "@formbricks/types/surveys";
import { Button } from "@formbricks/ui/Button";
import { Checkbox } from "@formbricks/ui/Checkbox";
import { DropdownSelector } from "@formbricks/ui/DropdownSelector";
import { Label } from "@formbricks/ui/Label";
import { Modal } from "@formbricks/ui/Modal";

import { createOrUpdateIntegrationAction } from "../../actions";

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

  const [selectedQuestions, setSelectedQuestions] = useState<string[]>([]);
  const [isLinkingChannel, setIsLinkingChannel] = useState(false);
  const [selectedSurvey, setSelectedSurvey] = useState<TSurvey | null>(null);
  const [selectedChannel, setSelectedChannel] = useState<TIntegrationItem | null>(null);
  const [isDeleting, setIsDeleting] = useState<boolean>(false);
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
      return;
    }
    resetForm();
  }, [selectedIntegration, surveys]);

  const linkChannel = async () => {
    try {
      if (!selectedChannel) {
        throw new Error("Please select a Slack channel");
      }
      if (!selectedSurvey) {
        throw new Error("Please select a survey");
      }

      if (selectedQuestions.length === 0) {
        throw new Error("Please select at least one question");
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
            ? "All questions"
            : "Selected questions",
        createdAt: new Date(),
      };
      if (selectedIntegration) {
        // update action
        slackIntegrationData.config!.data[selectedIntegration.index] = integrationData;
      } else {
        // create action
        slackIntegrationData.config!.data.push(integrationData);
      }
      await createOrUpdateIntegrationAction(environmentId, slackIntegrationData);
      toast.success(`Integration ${selectedIntegration ? "updated" : "added"} successfully`);
      resetForm();
      setOpen(false);
    } catch (e) {
      toast.error(e.message);
    } finally {
      setIsLinkingChannel(false);
    }
  };

  const handleCheckboxChange = (questionId: string) => {
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
      await createOrUpdateIntegrationAction(environmentId, slackIntegrationData);
      toast.success("Integration removed successfully");
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
    <Modal open={open} setOpen={setOpenWithStates} noPadding closeOnOutsideClick={false}>
      <div className="flex h-full flex-col rounded-lg">
        <div className="rounded-t-lg bg-slate-100">
          <div className="flex w-full items-center justify-between p-6">
            <div className="flex items-center space-x-2">
              <div className="mr-1.5 h-6 w-6 text-slate-500">
                <Image className="w-12" src={SlackLogo} alt="Slack logo" />
              </div>
              <div>
                <div className="text-xl font-medium text-slate-700">Link Slack Channel</div>
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
                    label="Select Channel"
                    items={channels}
                    selectedItem={selectedChannel}
                    setSelectedItem={setSelectedChannel}
                    disabled={channels.length === 0}
                  />
                  {selectedChannel && hasMatchingId && (
                    <p className="text-xs text-amber-700">
                      <strong>Note:</strong> You have already connected another survey to this channel.
                    </p>
                  )}
                  <p className="m-1 text-xs text-slate-500">
                    {channels.length === 0 &&
                      "You have to create at least one channel to be able to setup this integration"}
                  </p>
                </div>
                <div>
                  <DropdownSelector
                    label="Select Survey"
                    items={surveys}
                    selectedItem={selectedSurvey}
                    setSelectedItem={setSelectedSurvey}
                    disabled={surveys.length === 0}
                  />
                  <p className="m-1 text-xs text-slate-500">
                    {surveys.length === 0 &&
                      "You have to create a survey to be able to setup this integration"}
                  </p>
                </div>
              </div>
              {selectedSurvey && (
                <div>
                  <Label htmlFor="Surveys">Questions</Label>
                  <div className="mt-1 rounded-lg border border-slate-200">
                    <div className="grid content-center rounded-lg bg-slate-50 p-3 text-left text-sm text-slate-900">
                      {checkForRecallInHeadline(selectedSurvey, "default")?.questions?.map((question) => (
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
              )}
            </div>
          </div>
          <div className="flex justify-end border-t border-slate-200 p-6">
            <div className="flex space-x-2">
              {selectedIntegration ? (
                <Button type="button" variant="warn" loading={isDeleting} onClick={deleteLink}>
                  Delete
                </Button>
              ) : (
                <Button
                  type="button"
                  variant="minimal"
                  onClick={() => {
                    setOpen(false);
                    resetForm();
                  }}>
                  Cancel
                </Button>
              )}
              <Button variant="darkCTA" type="submit" loading={isLinkingChannel}>
                {selectedIntegration ? "Update" : "Link Channel"}
              </Button>
            </div>
          </div>
        </form>
      </div>
    </Modal>
  );
};
