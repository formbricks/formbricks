import {
  createSurveyFollowUpAction,
  updateSurveyFollowUpAction,
} from "@/app/(app)/(survey-editor)/environments/[environmentId]/surveys/[surveyId]/edit/actions";
import FollowUpActionMultiEmailInput from "@/app/(app)/(survey-editor)/environments/[environmentId]/surveys/[surveyId]/edit/components/FollowUpActionMultiEmailInput";
import { zodResolver } from "@hookform/resolvers/zod";
import { EyeOffIcon, HandshakeIcon, WorkflowIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import toast from "react-hot-toast";
import { TSurveyFollowUpTrigger } from "@formbricks/database/types/survey-follow-up";
import { getLocalizedValue } from "@formbricks/lib/i18n/utils";
import { QUESTIONS_ICON_MAP } from "@formbricks/lib/utils/questions";
import { TSurvey, TSurveyQuestionTypeEnum } from "@formbricks/types/surveys/types";
import { Button } from "@formbricks/ui/components/Button";
import { Checkbox } from "@formbricks/ui/components/Checkbox";
import { Editor } from "@formbricks/ui/components/Editor";
import {
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormProvider,
} from "@formbricks/ui/components/Form";
import { Input } from "@formbricks/ui/components/Input";
import { Modal } from "@formbricks/ui/components/Modal";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@formbricks/ui/components/Select";
import { TCreateSurveyFollowUpForm, ZCreateSurveyFollowUpFormSchema } from "../types/survey-follow-up";

interface AddFollowUpModalProps {
  localSurvey: TSurvey;
  setLocalSurvey: React.Dispatch<React.SetStateAction<TSurvey>>;
  open: boolean;
  setOpen: React.Dispatch<React.SetStateAction<boolean>>;
  selectedLanguageCode: string;
  mailFrom: string;
  defaultValues?: Partial<TCreateSurveyFollowUpForm & { surveyFollowUpId: string }>;
  mode?: "create" | "edit";
}

type EmailSendToOption = {
  type: "openTextQuestion" | "contactInfoQuestion" | "hiddenField";
  label: string;
  id: string;
};

export const FollowUpModal = ({
  localSurvey,
  open,
  setOpen,
  selectedLanguageCode,
  mailFrom,
  defaultValues,
  mode = "create",
}: AddFollowUpModalProps) => {
  const router = useRouter();
  const containerRef = useRef<HTMLDivElement>(null);
  const [firstRender, setFirstRender] = useState(true);

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

  const form = useForm<TCreateSurveyFollowUpForm>({
    defaultValues: {
      name: defaultValues?.name ?? "",
      triggerType: defaultValues?.triggerType ?? "response",
      endingIds: defaultValues?.endingIds || null,
      emailTo: defaultValues?.emailTo ?? emailSendToOptions[0].id,
      replyTo: defaultValues?.replyTo ?? [],
      subject: defaultValues?.subject ?? "",
      body: defaultValues?.body ?? "",
    },
    resolver: zodResolver(ZCreateSurveyFollowUpFormSchema),
    mode: "onChange",
  });

  const formErrors = form.formState.errors;
  const formSubmitting = form.formState.isSubmitting;
  const triggerType = form.watch("triggerType");

  const handleSubmit = async (data: TCreateSurveyFollowUpForm) => {
    if (data.triggerType === "endings") {
      if (!data.endingIds || !data.endingIds?.length) {
        form.setError("endingIds", {
          type: "manual",
          message: "Please select at least one ending",
        });
        return;
      }
    }

    const getProperties = (): TSurveyFollowUpTrigger["properties"] => {
      if (data.triggerType === "response") {
        return null;
      }

      if (data.endingIds && data.endingIds.length > 0) {
        return { endingIds: data.endingIds };
      }

      return null;
    };

    if (mode === "edit") {
      if (!defaultValues?.surveyFollowUpId) {
        console.error("No survey follow up id provided, can't update the survey follow up");
        return;
      }

      const res = await updateSurveyFollowUpAction({
        surveyId: localSurvey.id,
        surveyFollowUpId: defaultValues.surveyFollowUpId,
        followUpData: {
          name: data.name,
          trigger: {
            type: data.triggerType,
            properties: getProperties(),
          },
          action: {
            type: "send-email",
            properties: {
              to: data.emailTo,
              from: mailFrom,
              replyTo: data.replyTo,
              subject: data.subject,
              body: data.body,
            },
          },
        },
      });

      if (res?.data) {
        toast.success("Survey follow up updated successfully");
        setOpen(false);

        router.refresh();
      } else {
        toast.error("Something went wrong");
      }

      return;
    }

    const res = await createSurveyFollowUpAction({
      surveyId: localSurvey.id,
      followUpData: {
        name: data.name,
        trigger: {
          type: data.triggerType,
          properties: getProperties(),
        },
        action: {
          type: "send-email",
          properties: {
            to: data.emailTo,
            from: mailFrom,
            replyTo: data.replyTo,
            subject: data.subject,
            body: data.body,
          },
        },
      },
    });

    if (res?.data) {
      toast.success("Survey follow up created successfully");
      setOpen(false);

      router.refresh();
    } else {
      toast.error("Something went wrong");
    }
  };

  useEffect(() => {
    if (!open) {
      setFirstRender(true); // Reset when the modal is closed
    }
  }, [open]);

  useEffect(() => {
    let timeoutId: NodeJS.Timeout;

    if (open && containerRef.current) {
      timeoutId = setTimeout(() => {
        if (!containerRef.current) return;

        const scrollTop = containerRef.current.scrollTop;

        if (scrollTop > 0) {
          containerRef.current.scrollTo(0, 0);
        }
      }, 0);
    }

    // Clear the timeout when the effect is cleaned up or when open changes
    return () => {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    };
  }, [open, firstRender]);

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

      <FormProvider {...form}>
        <form onSubmit={form.handleSubmit(handleSubmit)}>
          <div className="mb-12 h-full max-h-[600px] overflow-auto px-6 py-4" ref={containerRef}>
            <div className="flex flex-col space-y-4">
              {/* workflow name */}
              <div className="flex flex-col space-y-2">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => {
                    return (
                      <FormItem>
                        <FormLabel className="text-base" htmlFor="name">
                          Follow-up name:
                        </FormLabel>
                        <FormControl>
                          <Input
                            {...field}
                            className="max-w-80"
                            isInvalid={!!formErrors.name}
                            placeholder="Name of your follow-up"
                          />
                        </FormControl>
                      </FormItem>
                    );
                  }}
                />
              </div>

              {/* trigger */}

              <div className="flex flex-col space-y-2 rounded-md border border-slate-300 p-4">
                <h2 className="text-lg font-medium text-slate-900">Trigger</h2>

                <FormField
                  control={form.control}
                  name="triggerType"
                  render={({ field }) => {
                    return (
                      <FormItem>
                        <div className="flex flex-col space-y-2">
                          <FormLabel htmlFor="triggerType">
                            When should this follow-up be triggered?
                          </FormLabel>
                          <div className="max-w-80">
                            <Select
                              defaultValue={field.value}
                              onValueChange={(value) => field.onChange(value)}>
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>

                              <SelectContent>
                                <SelectItem value="response">Any response is submitted</SelectItem>
                                <SelectItem value="endings">An ending(s)</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                      </FormItem>
                    );
                  }}
                />

                {triggerType === "endings" ? (
                  <FormField
                    control={form.control}
                    name="endingIds"
                    render={({ field }) => {
                      return (
                        <div className="flex flex-col space-y-2">
                          <h3 className="text-sm font-medium text-slate-700">Select endings: </h3>
                          <div className="flex flex-col space-y-2">
                            {localSurvey.endings.map((ending) => {
                              const getEndingLabel = (): string => {
                                if (ending.type === "endScreen") {
                                  return getLocalizedValue(ending.headline, selectedLanguageCode) || "Ending";
                                }

                                return ending.label || ending.url || "Ending";
                              };

                              return (
                                <div className="w-80 rounded-md border border-slate-300 px-3 py-2">
                                  <div className="flex items-center space-x-2">
                                    <Checkbox
                                      className="inline"
                                      checked={field.value?.includes(ending.id)}
                                      onCheckedChange={(checked) => {
                                        if (checked) {
                                          form.setValue("endingIds", [...(field.value ?? []), ending.id]);
                                        } else {
                                          form.setValue(
                                            "endingIds",
                                            (field.value ?? []).filter((id) => id !== ending.id)
                                          );
                                        }
                                      }}
                                    />
                                    <HandshakeIcon className="h-4 min-h-4 w-4 min-w-4" />
                                    <span className="overflow-hidden text-ellipsis whitespace-nowrap text-slate-900">
                                      {getEndingLabel()}
                                    </span>
                                  </div>
                                </div>
                              );
                            })}

                            {formErrors.endingIds ? (
                              <div className="mt-2">
                                <span className="text-red-500">{formErrors.endingIds.message}</span>
                              </div>
                            ) : null}
                          </div>
                        </div>
                      );
                    }}
                  />
                ) : null}
              </div>

              {/* action */}

              <div className="flex flex-col space-y-2 rounded-md border border-slate-300 p-4">
                <h2 className="text-lg font-medium text-slate-900">Action</h2>
                <div className="flex flex-col space-y-4">
                  {/* email setup */}
                  <div className="flex flex-col space-y-4">
                    <h2 className="text-lg font-medium text-slate-900">Email setup</h2>
                    {/* To */}

                    <div className="flex flex-col space-y-2">
                      <FormField
                        control={form.control}
                        name="emailTo"
                        render={({ field }) => {
                          return (
                            <div className="flex flex-col space-y-2">
                              <FormLabel htmlFor="emailTo" className="font-medium text-slate-900">
                                To
                              </FormLabel>
                              <FormDescription className="text-sm text-slate-500">
                                Email address to send the email to
                              </FormDescription>

                              <div className="max-w-80">
                                <FormControl>
                                  <Select
                                    defaultValue={field.value}
                                    onValueChange={(value) => {
                                      const selectedOption = emailSendToOptions.find(
                                        (option) => option.id === value
                                      );
                                      if (!selectedOption) return;

                                      field.onChange(selectedOption.id);
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
                                                      option.type === "openTextQuestion"
                                                        ? "openText"
                                                        : "contactInfo"
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
                                </FormControl>
                              </div>
                            </div>
                          );
                        }}
                      />
                    </div>

                    {/* From */}

                    <div className="flex flex-col space-y-2">
                      <h3 className="text-sm font-medium text-slate-900">From</h3>
                      <p className="text-sm text-slate-500">Email address to send the email from</p>

                      <div className="w-fit rounded-md border border-slate-200 bg-slate-100 px-2 py-1">
                        <span className="text-sm text-slate-900">{mailFrom}</span>
                      </div>
                    </div>

                    {/* Reply To */}

                    <div className="flex flex-col space-y-2">
                      <FormField
                        control={form.control}
                        name="replyTo"
                        render={({ field }) => {
                          return (
                            <FormItem>
                              <FormLabel htmlFor="replyTo">Reply To</FormLabel>
                              <FormDescription className="text-sm text-slate-500">
                                Email address to send the email from
                              </FormDescription>
                              <FormControl>
                                <FollowUpActionMultiEmailInput
                                  emails={field.value}
                                  setEmails={field.onChange}
                                  isInvalid={!!formErrors.replyTo}
                                />
                              </FormControl>
                            </FormItem>
                          );
                        }}
                      />
                    </div>
                  </div>

                  {/* email content */}

                  <div className="flex flex-col space-y-4">
                    <h2 className="text-lg font-medium text-slate-900">Email content</h2>
                    <FormField
                      control={form.control}
                      name="subject"
                      render={({ field }) => {
                        return (
                          <FormItem>
                            <div className="flex flex-col space-y-2">
                              <FormLabel>Subject</FormLabel>
                              <FormControl>
                                <Input
                                  {...field}
                                  className="max-w-80"
                                  placeholder="Subject of the email"
                                  isInvalid={!!formErrors.subject}
                                />
                              </FormControl>
                            </div>
                          </FormItem>
                        );
                      }}
                    />

                    <FormField
                      control={form.control}
                      name="body"
                      render={({ field }) => {
                        return (
                          <FormItem>
                            <div className="flex flex-col space-y-2">
                              <FormLabel className="font-medium text-slate-700">Body</FormLabel>
                              <FormControl>
                                <Editor
                                  disableLists
                                  excludedToolbarItems={["blockType"]}
                                  getText={() => field.value}
                                  setText={(v: string) => {
                                    field.onChange(v);
                                  }}
                                  firstRender={firstRender}
                                  setFirstRender={setFirstRender}
                                  placeholder="Body of the email"
                                />
                              </FormControl>
                            </div>
                          </FormItem>
                        );
                      }}
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="absolute bottom-0 right-0 z-20 h-12 w-full bg-white p-2">
            <div className="flex justify-end space-x-2">
              <Button
                type="button"
                variant="minimal"
                size="sm"
                onClick={() => {
                  setOpen(false);
                }}>
                Cancel
              </Button>

              <Button loading={formSubmitting} variant="primary" size="sm">
                Save
              </Button>
            </div>
          </div>
        </form>
      </FormProvider>
    </Modal>
  );
};
