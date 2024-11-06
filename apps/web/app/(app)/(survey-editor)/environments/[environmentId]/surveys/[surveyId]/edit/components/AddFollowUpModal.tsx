import FollowUpActionMultiEmailInput from "@/app/(app)/(survey-editor)/environments/[environmentId]/surveys/[surveyId]/edit/components/FollowUpActionMultiEmailInput";
import { CheckIcon, EyeOffIcon, HandshakeIcon, WorkflowIcon } from "lucide-react";
import { useMemo, useState } from "react";
import { getLocalizedValue } from "@formbricks/lib/i18n/utils";
import { QUESTIONS_ICON_MAP } from "@formbricks/lib/utils/questions";
import { TSurvey, TSurveyQuestionTypeEnum } from "@formbricks/types/surveys/types";
import { Button } from "@formbricks/ui/components/Button";
import { Editor } from "@formbricks/ui/components/Editor";
import { Input } from "@formbricks/ui/components/Input";
import { Modal } from "@formbricks/ui/components/Modal";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@formbricks/ui/components/Select";
import { cn } from "@formbricks/ui/lib/utils";

interface AddFollowUpModalProps {
  localSurvey: TSurvey;
  setLocalSurvey: React.Dispatch<React.SetStateAction<TSurvey>>;
  open: boolean;
  setOpen: React.Dispatch<React.SetStateAction<boolean>>;
  selectedLanguageCode: string;
  mailFrom: string;
}

type EmailSendToOption = {
  type: "openTextQuestion" | "contactInfoQuestion" | "hiddenField";
  label: string;
  id: string;
};

export const AddFollowUpModal = ({
  localSurvey,
  setLocalSurvey,
  open,
  setOpen,
  selectedLanguageCode,
  mailFrom,
}: AddFollowUpModalProps) => {
  const [firstRender, setFirstRender] = useState(true);
  const [followUpName, setFollowUpName] = useState("");
  const [triggerType, setTriggerType] = useState("response");
  const [selectedEndings, setSelectedEndings] = useState<string[]>([]);

  const emailSendToOptions: EmailSendToOption[] = useMemo(() => {
    const { questions } = localSurvey;

    const openTextAndContactQuestions = questions.filter((question) => {
      return (
        question.type === TSurveyQuestionTypeEnum.OpenText ||
        question.type === TSurveyQuestionTypeEnum.ContactInfo
      );
    });

    const hiddenFields =
      localSurvey.hiddenFields.enabled && localSurvey.hiddenFields.fieldIds
        ? { fieldIds: localSurvey.hiddenFields.fieldIds }
        : { fieldIds: [] };

    return [
      ...openTextAndContactQuestions.map((question) => ({
        label: getLocalizedValue(question.headline, selectedLanguageCode),
        id: question.id,
        type:
          question.type === TSurveyQuestionTypeEnum.OpenText
            ? "openTextQuestion"
            : ("contactInfoQuestion" as EmailSendToOption["type"]),
      })),

      ...hiddenFields.fieldIds.map((fieldId: string) => ({
        label: fieldId,
        id: fieldId,
        type: "hiddenField" as EmailSendToOption["type"],
      })),
    ];
  }, [localSurvey, selectedLanguageCode]);

  const [selectedEmailSendToOption, setSelectedEmailSendToOption] = useState<EmailSendToOption>(
    emailSendToOptions[0]
  );

  const [replyToEmails, setReplyToEmails] = useState<string[]>([]);

  const [actionEmailSubject, setActionEmailSubject] = useState("");
  const [actionEmailContent, setActionEmailContent] = useState("");

  return (
    <Modal open={open} setOpen={setOpen} noPadding size="xl">
      <div className="flex h-full flex-col rounded-lg">
        <div className="rounded-t-lg bg-slate-100">
          <div className="flex w-full items-center justify-between p-6">
            <div className="flex items-center space-x-2">
              <div className="mr-1.5 h-6 w-6 text-slate-500">
                <WorkflowIcon className="h-5 w-5" />
              </div>
              <div>
                <div className="text-xl font-medium text-slate-700">
                  Create a new follow-up for this survey
                </div>
                <div className="text-sm text-slate-500">
                  Follow-ups are used to trigger actions based on survey responses
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="mb-12 max-h-[600px] overflow-auto px-6 py-4">
        <div className="flex flex-col space-y-4">
          {/* workflow name */}
          <div className="flex flex-col space-y-2">
            <h2 className="font-medium text-slate-900">Follow-up name:</h2>
            <Input
              value={followUpName}
              onChange={(e) => setFollowUpName(e.target.value)}
              className="max-w-80"
            />
          </div>

          {/* trigger */}

          <div className="flex flex-col space-y-2 rounded-md border border-slate-300 p-4">
            <h2 className="text-lg font-medium text-slate-900">Trigger</h2>

            <div className="flex flex-col space-y-2">
              <h3 className="font-medium text-slate-700">When should this follow-up be triggered?</h3>
              <div className="max-w-80">
                <Select defaultValue={triggerType} onValueChange={(value) => setTriggerType(value)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>

                  <SelectContent>
                    <SelectItem value="response">Any response is submitted</SelectItem>
                    <SelectItem value="ending">An ending(s)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {triggerType === "ending" ? (
              <div className="flex flex-col space-y-2">
                <h3 className="font-medium text-slate-700">Select endings: </h3>
                <div className="flex flex-col space-y-2">
                  {localSurvey.endings.map((ending) => {
                    const getEndingLabel = (): string => {
                      if (ending.type === "endScreen") {
                        return getLocalizedValue(ending.headline, selectedLanguageCode) || "Ending";
                      }

                      return ending.label || ending.url || "Ending";
                    };

                    return (
                      <button
                        className={cn(
                          "relative max-w-80 rounded-md border px-3 py-2",
                          selectedEndings.includes(ending.id) ? "border-slate-900" : "border-slate-300"
                        )}
                        onClick={() => {
                          if (selectedEndings.includes(ending.id)) {
                            setSelectedEndings(selectedEndings.filter((id) => id !== ending.id));
                            return;
                          }

                          setSelectedEndings([...selectedEndings, ending.id]);
                        }}>
                        <div className="flex items-center space-x-2">
                          <HandshakeIcon className="h-4 min-h-4 w-4 min-w-4" />
                          <span className="overflow-hidden text-ellipsis whitespace-nowrap text-slate-900">
                            {getEndingLabel()}
                          </span>
                        </div>

                        {selectedEndings.includes(ending.id) ? (
                          <div className="absolute bottom-0 right-1 top-0 z-10 flex items-center space-x-2">
                            <CheckIcon className="h-4 w-4" />
                          </div>
                        ) : null}
                      </button>
                    );
                  })}
                </div>
              </div>
            ) : null}
          </div>

          {/* action */}

          <div className="flex flex-col space-y-2 rounded-md border border-slate-300 p-4">
            <h2 className="text-lg font-medium text-slate-900">Action</h2>
            <div className="flex flex-col space-y-4">
              {/* email setup */}
              <div className="flex flex-col space-y-2">
                <h2 className="text-lg font-medium text-slate-900">Email setup</h2>
                {/* To */}

                <div className="flex flex-col space-y-2">
                  <h3 className="font-medium text-slate-900">To</h3>
                  <p className="text-sm text-slate-500">Email address to send the email to</p>

                  <div className="max-w-80">
                    <Select
                      defaultValue={selectedEmailSendToOption.id}
                      onValueChange={(value) => {
                        const selectedOption = emailSendToOptions.find((option) => option.id === value);
                        if (!selectedOption) return;

                        setSelectedEmailSendToOption(selectedOption);
                      }}>
                      <SelectTrigger className="overflow-hidden text-ellipsis whitespace-nowrap">
                        <SelectValue />
                      </SelectTrigger>

                      <SelectContent>
                        {emailSendToOptions.map((option) => {
                          return (
                            <SelectItem value={option.id}>
                              {option.type !== "hiddenField" ? (
                                <div className="flex items-center space-x-2">
                                  <div className="h-4 w-4">
                                    {
                                      QUESTIONS_ICON_MAP[
                                        option.type === "openTextQuestion" ? "openText" : "contactInfo"
                                      ]
                                    }
                                  </div>
                                  <span className="overflow-hidden text-ellipsis whitespace-nowrap">
                                    {option.label}
                                  </span>
                                </div>
                              ) : (
                                <div className="flex items-center space-x-2">
                                  <EyeOffIcon className="h-4 w-4" />
                                  <span>{option.label}</span>
                                </div>
                              )}
                            </SelectItem>
                          );
                        })}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* From */}

                <div className="flex flex-col space-y-2">
                  <h3 className="font-medium text-slate-900">From</h3>
                  <p className="text-sm text-slate-500">Email address to send the email from</p>

                  <div className="w-fit rounded-md border border-slate-200 bg-slate-100 px-2 py-1">
                    <span className="text-sm text-slate-900">{mailFrom}</span>
                  </div>
                </div>

                {/* Reply To */}

                <div className="flex flex-col space-y-2">
                  <h3 className="font-medium text-slate-900">Reply To</h3>
                  <p className="text-sm text-slate-500">Email address to send the email from</p>

                  {/* <Input className="max-w-80" /> */}
                  <FollowUpActionMultiEmailInput emails={replyToEmails} setEmails={setReplyToEmails} />
                </div>
              </div>

              {/* email content */}

              <div className="flex flex-col space-y-2">
                <h2 className="text-lg font-medium text-slate-900">Email content</h2>
                <div className="flex flex-col space-y-2">
                  <h3 className="font-medium text-slate-700">Subject</h3>
                  <Input
                    className="max-w-80"
                    value={actionEmailSubject}
                    placeholder="Subject of the email"
                    onChange={(e) => setActionEmailSubject(e.target.value)}
                  />
                </div>

                <div className="flex flex-col space-y-2">
                  <h3 className="font-medium text-slate-700">Body</h3>
                  <Editor
                    disableLists
                    excludedToolbarItems={["blockType"]}
                    getText={() => actionEmailContent}
                    setText={(v: string) => {
                      setActionEmailContent(v);
                    }}
                    firstRender={firstRender}
                    setFirstRender={setFirstRender}
                    placeholder="Body of the email"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="absolute bottom-0 right-0 z-20 h-12 w-full bg-white p-2">
        <div className="flex justify-end space-x-2">
          <Button
            variant="minimal"
            size="sm"
            onClick={() => {
              setOpen(false);
            }}>
            Cancel
          </Button>

          <Button
            variant="primary"
            size="sm"
            onClick={() => {
              console.log("state: ");
              console.log(
                followUpName,
                triggerType,
                selectedEndings,
                selectedEmailSendToOption,
                replyToEmails,
                actionEmailSubject,
                actionEmailContent
              );
            }}>
            Save
          </Button>
        </div>
      </div>
    </Modal>
  );
};
