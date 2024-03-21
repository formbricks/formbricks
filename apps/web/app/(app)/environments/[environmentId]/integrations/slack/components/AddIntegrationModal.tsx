import SlackLogo from "@/images/slacklogo.png";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { ChevronDownIcon } from "lucide-react";
import Image from "next/image";
import { useEffect, useState } from "react";
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
import { Label } from "@formbricks/ui/Label";
import { Modal } from "@formbricks/ui/Modal";

import { createOrUpdateIntegrationAction } from "../../actions";

interface AddIntegrationModalProps {
  environmentId: string;
  surveys: TSurvey[];
  open: boolean;
  setOpen: (v: boolean) => void;
  slackIntegration: TIntegrationSlack;
  channels: TIntegrationItem[];
  selectedIntegration?: (TIntegrationSlackConfigData & { index: number }) | null;
}

export default function AddIntegrationModal({
  environmentId,
  surveys,
  open,
  setOpen,
  channels,
  slackIntegration,
  selectedIntegration,
}: AddIntegrationModalProps) {
  const { handleSubmit } = useForm();

  const integrationData = {
    channelId: "",
    channelName: "",
    surveyId: "",
    surveyName: "",
    questionIds: [""],
    questions: "",
    createdAt: new Date(),
  };

  const [selectedQuestions, setSelectedQuestions] = useState<string[]>([]);
  const [isLinkingChannel, setIsLinkingChannel] = useState(false);
  const [selectedSurvey, setSelectedSurvey] = useState<TSurvey | null>(null);
  const [selectedChannel, setSelectedChannel] = useState<TIntegrationItem | null>(null);
  const [isDeleting, setIsDeleting] = useState<any>(null);
  const existingIntegrationData = slackIntegration?.config?.data;
  const slackIntegrationData: TIntegrationSlackInput = {
    type: "slack",
    config: {
      key: slackIntegration?.config?.key,
      user: slackIntegration.config.user,
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
        throw new Error("Please select a slack channel");
      }
      if (!selectedSurvey) {
        throw new Error("Please select a survey");
      }

      if (selectedQuestions.length === 0) {
        throw new Error("Please select at least one question");
      }
      setIsLinkingChannel(true);
      integrationData.channelId = selectedChannel.id;
      integrationData.channelName = selectedChannel.name;
      integrationData.surveyId = selectedSurvey.id;
      integrationData.surveyName = selectedSurvey.name;
      integrationData.questionIds = selectedQuestions;
      integrationData.questions =
        selectedQuestions.length === selectedSurvey?.questions.length
          ? "All questions"
          : "Selected questions";
      integrationData.createdAt = new Date();
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

  const hasMatchingId = slackIntegration.config.data.some((configData) => {
    if (!selectedChannel) {
      return false;
    }
    return configData.channelId === selectedChannel.id && !selectedIntegration;
  });

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
                      <strong>Warning:</strong> You have already connected one survey with this channel. Your
                      data will be inconsistent
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
                <Button
                  type="button"
                  variant="warn"
                  loading={isDeleting}
                  onClick={() => {
                    deleteLink();
                  }}>
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
}

const DropdownSelector = ({ label, items, selectedItem, setSelectedItem, disabled }) => {
  return (
    <div className="col-span-1">
      <Label htmlFor={label}>{label}</Label>
      <div className="mt-1 flex">
        <DropdownMenu.Root>
          <DropdownMenu.Trigger asChild>
            <button
              disabled={disabled ? disabled : false}
              type="button"
              className="flex h-10 w-full rounded-md border border-slate-300 bg-transparent px-3 py-2 text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-500 dark:text-slate-300">
              <span className="flex flex-1">
                <span>{selectedItem ? selectedItem.name : `${label}`}</span>
              </span>
              <span className="flex h-full items-center border-l pl-3">
                <ChevronDownIcon className="h-4 w-4 text-gray-500" />
              </span>
            </button>
          </DropdownMenu.Trigger>

          {!disabled && (
            <DropdownMenu.Portal>
              <DropdownMenu.Content
                className="z-50 min-w-[220px] rounded-md bg-white text-sm text-slate-800 shadow-md"
                align="start">
                {items &&
                  items.map((item) => (
                    <DropdownMenu.Item
                      key={item.id}
                      className="flex cursor-pointer items-center p-3 hover:bg-gray-100 hover:outline-none data-[disabled]:cursor-default data-[disabled]:opacity-50"
                      onSelect={() => setSelectedItem(item)}>
                      {item.name}
                    </DropdownMenu.Item>
                  ))}
              </DropdownMenu.Content>
            </DropdownMenu.Portal>
          )}
        </DropdownMenu.Root>
      </div>
    </div>
  );
};
