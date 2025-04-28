"use client";

import { getLocalizedValue } from "@/lib/i18n/utils";
import { recallToHeadline } from "@/lib/utils/recall";
import { getSurveyFollowUpActionDefaultBody } from "@/modules/survey/editor/lib/utils";
import {
  TCreateSurveyFollowUpForm,
  TFollowUpEmailToUser,
  ZCreateSurveyFollowUpFormSchema,
} from "@/modules/survey/editor/types/survey-follow-up";
import FollowUpActionMultiEmailInput from "@/modules/survey/follow-ups/components/follow-up-action-multi-email-input";
import { getQuestionIconMap } from "@/modules/survey/lib/questions";
import { Alert, AlertTitle } from "@/modules/ui/components/alert";
import { Button } from "@/modules/ui/components/button";
import { Checkbox } from "@/modules/ui/components/checkbox";
import { Editor } from "@/modules/ui/components/editor";
import {
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormProvider,
} from "@/modules/ui/components/form";
import { Input } from "@/modules/ui/components/input";
import { Label } from "@/modules/ui/components/label";
import { Modal } from "@/modules/ui/components/modal";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/modules/ui/components/select";
import { cn } from "@/modules/ui/lib/utils";
import { zodResolver } from "@hookform/resolvers/zod";
import { createId } from "@paralleldrive/cuid2";
import { useTranslate } from "@tolgee/react";
import DOMpurify from "isomorphic-dompurify";
import {
  ArrowDownIcon,
  EyeOffIcon,
  HandshakeIcon,
  MailIcon,
  TriangleAlertIcon,
  UserIcon,
  ZapIcon,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import toast from "react-hot-toast";
import { TSurveyFollowUpAction, TSurveyFollowUpTrigger } from "@formbricks/database/types/survey-follow-up";
import { TSurvey, TSurveyQuestionTypeEnum } from "@formbricks/types/surveys/types";
import { TUserLocale } from "@formbricks/types/user";

interface AddFollowUpModalProps {
  localSurvey: TSurvey;
  open: boolean;
  setOpen: React.Dispatch<React.SetStateAction<boolean>>;
  selectedLanguageCode: string;
  mailFrom: string;
  defaultValues?: Partial<TCreateSurveyFollowUpForm & { surveyFollowUpId: string }>;
  mode?: "create" | "edit";
  userEmail: string;
  teamMemberDetails: TFollowUpEmailToUser[];
  setLocalSurvey: React.Dispatch<React.SetStateAction<TSurvey>>;
  locale: TUserLocale;
}

type EmailSendToOption = {
  type: "openTextQuestion" | "contactInfoQuestion" | "hiddenField" | "user";
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
  userEmail,
  teamMemberDetails,
  setLocalSurvey,
  locale,
}: AddFollowUpModalProps) => {
  const { t } = useTranslate();
  const QUESTIONS_ICON_MAP = getQuestionIconMap(t);
  const containerRef = useRef<HTMLDivElement>(null);
  const [firstRender, setFirstRender] = useState(true);

  const emailSendToOptions: EmailSendToOption[] = useMemo(() => {
    const { questions } = localSurvey;

    const openTextAndContactQuestions = questions.filter((question) => {
      if (question.type === TSurveyQuestionTypeEnum.ContactInfo) {
        return true;
      }

      if (question.type === TSurveyQuestionTypeEnum.OpenText) {
        if (question.inputType === "email") {
          return true;
        }

        return false;
      }

      return false;
    });

    const hiddenFields =
      localSurvey.hiddenFields.enabled && localSurvey.hiddenFields.fieldIds
        ? { fieldIds: localSurvey.hiddenFields.fieldIds }
        : { fieldIds: [] };

    const updatedTeamMemberDetails = teamMemberDetails.map((teamMemberDetail) => {
      if (teamMemberDetail.email === userEmail) {
        return { name: "Yourself", email: userEmail };
      }

      return teamMemberDetail;
    });

    const isUserEmailInTeamMemberDetails = updatedTeamMemberDetails.some(
      (teamMemberDetail) => teamMemberDetail.email === userEmail
    );

    const updatedTeamMembers = isUserEmailInTeamMemberDetails
      ? updatedTeamMemberDetails
      : [...updatedTeamMemberDetails, { email: userEmail, name: "Yourself" }];

    return [
      ...openTextAndContactQuestions.map((question) => ({
        label: recallToHeadline(question.headline, localSurvey, false, selectedLanguageCode)[
          selectedLanguageCode
        ],
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

      ...updatedTeamMembers.map((member) => ({
        label: `${member.name} (${member.email})`,
        id: member.email,
        type: "user" as EmailSendToOption["type"],
      })),
    ];
  }, [localSurvey, selectedLanguageCode, teamMemberDetails, userEmail]);

  const form = useForm<TCreateSurveyFollowUpForm>({
    defaultValues: {
      followUpName: defaultValues?.followUpName ?? "",
      triggerType: defaultValues?.triggerType ?? "response",
      endingIds: defaultValues?.endingIds || null,
      emailTo: defaultValues?.emailTo ?? emailSendToOptions[0]?.id,
      replyTo: defaultValues?.replyTo ?? [userEmail],
      subject: defaultValues?.subject ?? t("environments.surveys.edit.follow_ups_modal_action_subject"),
      body: defaultValues?.body ?? getSurveyFollowUpActionDefaultBody(t),
      attachResponseData: defaultValues?.attachResponseData ?? false,
    },
    resolver: zodResolver(ZCreateSurveyFollowUpFormSchema),
    mode: "onChange",
  });

  const formErrors = form.formState.errors;
  const formSubmitting = form.formState.isSubmitting;
  const triggerType = form.watch("triggerType");

  const handleSubmit = (data: TCreateSurveyFollowUpForm) => {
    if (data.triggerType === "endings" && data.endingIds?.length === 0) {
      toast.error("Please select at least one ending or change the trigger type");
      return;
    }

    if (!emailSendToOptions.length) {
      toast.error(
        "No valid options found for sending emails, please add some open-text / contact-info questions or hidden fields"
      );

      return;
    }

    if (Object.keys(formErrors).length > 0) {
      return;
    }

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
        toast.error(t("environments.surveys.edit.follow_ups_modal_edit_no_id"));
        return;
      }

      const currentFollowUp = localSurvey.followUps.find(
        (followUp) => followUp.id === defaultValues.surveyFollowUpId
      );

      const sanitizedBody = DOMpurify.sanitize(data.body, {
        ALLOWED_TAGS: ["p", "span", "b", "strong", "i", "em", "a", "br"],
        ALLOWED_ATTR: ["href", "rel", "dir", "class"],
        ALLOWED_URI_REGEXP: /^https?:\/\//, // Only allow safe URLs starting with http or https
        ADD_ATTR: ["target"], // Optional: Allow 'target' attribute for links (e.g., _blank)
      });

      const updatedFollowUp = {
        id: defaultValues.surveyFollowUpId,
        createdAt: currentFollowUp?.createdAt ?? new Date(),
        updatedAt: new Date(),
        surveyId: localSurvey.id,
        name: data.followUpName,
        trigger: {
          type: data.triggerType,
          properties: getProperties(),
        },
        action: {
          type: "send-email" as TSurveyFollowUpAction["type"],
          properties: {
            to: data.emailTo,
            from: mailFrom,
            replyTo: data.replyTo,
            subject: data.subject,
            body: sanitizedBody,
            attachResponseData: data.attachResponseData,
          },
        },
      };

      toast.success("Survey follow up updated successfully");
      setOpen(false);
      setLocalSurvey((prev) => {
        return {
          ...prev,
          followUps: prev.followUps.map((followUp) => {
            if (followUp.id === defaultValues.surveyFollowUpId) {
              return updatedFollowUp;
            }

            return followUp;
          }),
        };
      });
      return;
    }

    const sanitizedBody = DOMpurify.sanitize(data.body, {
      ALLOWED_TAGS: ["p", "span", "b", "strong", "i", "em", "a", "br"],
      ALLOWED_ATTR: ["href", "rel", "dir", "class"],
      ALLOWED_URI_REGEXP: /^https?:\/\//, // Only allow safe URLs starting with http or https
      ADD_ATTR: ["target"], // Optional: Allow 'target' attribute for links (e.g., _blank)
    });

    const newFollowUp = {
      id: createId(),
      createdAt: new Date(),
      updatedAt: new Date(),
      surveyId: localSurvey.id,
      name: data.followUpName,
      trigger: {
        type: data.triggerType,
        properties: getProperties(),
      },
      action: {
        type: "send-email" as TSurveyFollowUpAction["type"],
        properties: {
          to: data.emailTo,
          from: mailFrom,
          replyTo: data.replyTo,
          subject: data.subject,
          body: sanitizedBody,
          attachResponseData: data.attachResponseData,
        },
      },
    };

    toast.success("Survey follow up created successfully");
    setOpen(false);
    form.reset();
    setLocalSurvey((prev) => {
      return {
        ...prev,
        followUps: [...prev.followUps, newFollowUp],
      };
    });
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

  useEffect(() => {
    if (open && defaultValues) {
      form.reset({
        followUpName: defaultValues?.followUpName ?? "",
        triggerType: defaultValues?.triggerType ?? "response",
        endingIds: defaultValues?.endingIds || null,
        emailTo: defaultValues?.emailTo ?? emailSendToOptions[0]?.id,
        replyTo: defaultValues?.replyTo ?? [userEmail],
        subject: defaultValues?.subject ?? "Thanks for your answers!",
        body: defaultValues?.body ?? getSurveyFollowUpActionDefaultBody(t),
        attachResponseData: defaultValues?.attachResponseData ?? false,
      });
    }
  }, [open, defaultValues, emailSendToOptions, form, userEmail, locale, t]);

  const handleModalClose = () => {
    form.reset();
    setOpen(false);
  };

  const emailSendToQuestionOptions = emailSendToOptions.filter(
    (option) => option.type === "openTextQuestion" || option.type === "contactInfoQuestion"
  );
  const emailSendToHiddenFieldOptions = emailSendToOptions.filter((option) => option.type === "hiddenField");
  const userSendToEmailOptions = emailSendToOptions.filter((option) => option.type === "user");

  const renderSelectItem = (option: EmailSendToOption) => {
    return (
      <SelectItem key={option.id} value={option.id}>
        {option.type === "hiddenField" ? (
          <div className="flex items-center space-x-2">
            <EyeOffIcon className="h-4 w-4" />
            <span>{option.label}</span>
          </div>
        ) : option.type === "user" ? (
          <div className="flex items-center space-x-2">
            <UserIcon className="h-4 w-4" />
            <span className="overflow-hidden text-ellipsis whitespace-nowrap">{option.label}</span>
          </div>
        ) : (
          <div className="flex items-center space-x-2">
            <div className="h-4 w-4">
              {QUESTIONS_ICON_MAP[option.type === "openTextQuestion" ? "openText" : "contactInfo"]}
            </div>
            <span className="overflow-hidden text-ellipsis whitespace-nowrap">{option.label}</span>
          </div>
        )}
      </SelectItem>
    );
  };

  return (
    <Modal open={open} setOpen={handleModalClose} noPadding size="md">
      <div className="flex h-full flex-col rounded-lg">
        <div className="rounded-t-lg bg-slate-100">
          <div className="flex w-full items-center justify-between p-6">
            <div className="flex items-center space-x-2">
              <div className="mr-1.5 h-6 w-6 text-slate-500">
                <MailIcon className="h-5 w-5" />
              </div>
              <div>
                <div className="text-xl font-medium text-slate-700">
                  {mode === "edit"
                    ? t("environments.surveys.edit.follow_ups_modal_edit_heading")
                    : t("environments.surveys.edit.follow_ups_modal_create_heading")}
                </div>
                <div className="text-sm text-slate-500">
                  {t("environments.surveys.edit.follow_ups_modal_subheading")}
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
              {/* Follow up name */}
              <div className="flex flex-col space-y-2">
                <FormField
                  control={form.control}
                  name="followUpName"
                  render={({ field }) => {
                    return (
                      <FormItem>
                        <FormLabel htmlFor="follow-up-name">
                          {t("environments.surveys.edit.follow_ups_modal_name_label")}:
                        </FormLabel>
                        <FormControl>
                          <Input
                            {...field}
                            type="text"
                            className="max-w-80"
                            isInvalid={!!formErrors.followUpName}
                            placeholder={t("environments.surveys.edit.follow_ups_modal_name_placeholder")}
                          />
                        </FormControl>
                      </FormItem>
                    );
                  }}
                />
              </div>

              {/* Trigger */}
              <div className="flex flex-col rounded-lg border border-slate-300">
                <div className="flex items-center gap-x-2 rounded-t-lg border-b border-slate-300 bg-slate-100 px-4 py-2">
                  <div className="rounded-full border border-slate-300 bg-white p-1">
                    <ZapIcon className="h-3 w-3 text-slate-500" />
                  </div>
                  <h2 className="text-md font-semibold text-slate-900">
                    {t("environments.surveys.edit.follow_ups_modal_trigger_label")}
                  </h2>
                </div>

                <div className="flex flex-col gap-4 p-4">
                  <FormField
                    control={form.control}
                    name="triggerType"
                    render={({ field }) => {
                      return (
                        <FormItem>
                          <div className="flex flex-col space-y-2">
                            <FormLabel htmlFor="triggerType">
                              {t("environments.surveys.edit.follow_ups_modal_trigger_description")}
                            </FormLabel>
                            <div className="max-w-80">
                              <Select
                                defaultValue={field.value}
                                onValueChange={(value) => field.onChange(value)}>
                                <SelectTrigger>
                                  <SelectValue />
                                </SelectTrigger>

                                <SelectContent>
                                  <SelectItem value="response">
                                    {t("environments.surveys.edit.follow_ups_modal_trigger_type_response")}
                                  </SelectItem>
                                  {localSurvey.endings.length > 0 ? (
                                    <SelectItem value="endings">
                                      {t("environments.surveys.edit.follow_ups_modal_trigger_type_ending")}
                                    </SelectItem>
                                  ) : null}
                                </SelectContent>
                              </Select>

                              {triggerType === "endings" && !localSurvey.endings.length ? (
                                <Alert variant="warning" size="small">
                                  <AlertTitle>
                                    {t(
                                      "environments.surveys.edit.follow_ups_modal_trigger_type_ending_warning"
                                    )}
                                  </AlertTitle>
                                </Alert>
                              ) : null}
                            </div>
                          </div>
                        </FormItem>
                      );
                    }}
                  />

                  {localSurvey.endings.length > 0 && triggerType === "endings" ? (
                    <FormField
                      control={form.control}
                      name="endingIds"
                      render={({ field }) => {
                        return (
                          <div className="flex flex-col space-y-2">
                            <h3 className="text-sm font-medium text-slate-700">
                              {t("environments.surveys.edit.follow_ups_modal_trigger_type_ending_select")}
                            </h3>
                            <div className="flex flex-col space-y-2">
                              {localSurvey.endings.map((ending) => {
                                const getEndingLabel = (): string => {
                                  if (ending.type === "endScreen") {
                                    return (
                                      getLocalizedValue(ending.headline, selectedLanguageCode) || "Ending"
                                    );
                                  }

                                  return ending.label || ending.url || "Ending";
                                };

                                return (
                                  <Label
                                    key={ending.id}
                                    className="w-80 cursor-pointer rounded-md border border-slate-300 bg-slate-50 px-3 py-2 hover:bg-slate-100"
                                    htmlFor={`ending-${ending.id}`}>
                                    <div className="flex items-center space-x-2">
                                      <Checkbox
                                        className="inline"
                                        checked={field.value?.includes(ending.id)}
                                        id={`ending-${ending.id}`}
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
                                  </Label>
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
              </div>

              {/* Arrow */}
              <div className="flex items-center justify-center">
                <ArrowDownIcon className="h-4 w-4 text-slate-500" />
              </div>

              {/* Action */}
              <div className="flex flex-col rounded-lg border border-slate-300">
                <div className="flex items-center gap-x-2 rounded-t-lg border-b border-slate-300 bg-slate-100 px-4 py-2">
                  <div className="rounded-full border border-slate-300 bg-white p-1">
                    <MailIcon className="h-3 w-3 text-slate-500" />
                  </div>
                  <h2 className="text-md font-semibold text-slate-900">
                    {t("environments.surveys.edit.follow_ups_modal_action_label")}
                  </h2>
                </div>

                {/* email setup */}
                <div className="flex flex-col gap-y-4 p-4">
                  <h2 className="text-md font-semibold text-slate-900">
                    {t("environments.surveys.edit.follow_ups_modal_action_email_settings")}
                  </h2>

                  {/* To */}

                  <div className="flex flex-col space-y-2">
                    <FormField
                      control={form.control}
                      name="emailTo"
                      render={({ field }) => {
                        return (
                          <div className="flex flex-col space-y-2">
                            <FormLabel htmlFor="emailTo" className="font-medium">
                              {t("environments.surveys.edit.follow_ups_modal_action_to_label")}
                            </FormLabel>
                            <FormDescription
                              className={cn(
                                "text-sm",
                                formErrors.emailTo ? "text-red-500" : "text-slate-500"
                              )}>
                              {t("environments.surveys.edit.follow_ups_modal_action_to_description")}
                            </FormDescription>

                            {emailSendToOptions.length === 0 && (
                              <div className="mt-4 flex items-start text-yellow-600">
                                <TriangleAlertIcon
                                  className="mr-2 h-5 min-h-5 w-5 min-w-5"
                                  aria-hidden="true"
                                />
                                <p className="text-sm">
                                  {t("environments.surveys.edit.follow_ups_modal_action_to_warning")}
                                </p>
                              </div>
                            )}

                            {emailSendToOptions.length > 0 ? (
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
                                      {emailSendToQuestionOptions.length > 0 ? (
                                        <div className="flex flex-col">
                                          <div className="flex items-center space-x-2 p-2">
                                            <p className="text-sm text-slate-500">Questions</p>
                                          </div>

                                          {emailSendToQuestionOptions.map((option) =>
                                            renderSelectItem(option)
                                          )}
                                        </div>
                                      ) : null}

                                      {emailSendToHiddenFieldOptions.length > 0 ? (
                                        <div className="flex flex-col">
                                          <div className="flex space-x-2 p-2">
                                            <p className="text-sm text-slate-500">Hidden Fields</p>
                                          </div>

                                          {emailSendToHiddenFieldOptions.map((option) =>
                                            renderSelectItem(option)
                                          )}
                                        </div>
                                      ) : null}

                                      {userSendToEmailOptions.length > 0 ? (
                                        <div className="flex flex-col">
                                          <div className="flex space-x-2 p-2">
                                            <p className="text-sm text-slate-500">Users</p>
                                          </div>

                                          {userSendToEmailOptions.map((option) => renderSelectItem(option))}
                                        </div>
                                      ) : null}
                                    </SelectContent>
                                  </Select>
                                </FormControl>
                              </div>
                            ) : null}
                          </div>
                        );
                      }}
                    />
                  </div>

                  {/* From */}

                  <div className="flex flex-col space-y-2">
                    <h3 className="text-sm font-medium text-slate-900">
                      {t("environments.surveys.edit.follow_ups_modal_action_from_label")}
                    </h3>
                    <p className="text-sm text-slate-500">
                      {t("environments.surveys.edit.follow_ups_modal_action_from_description")}
                    </p>

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
                            <FormLabel htmlFor="replyTo">
                              {t("environments.surveys.edit.follow_ups_modal_action_replyTo_label")}
                            </FormLabel>
                            <FormDescription className="text-sm text-slate-500">
                              {t("environments.surveys.edit.follow_ups_modal_action_replyTo_description")}
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

                <div className="flex flex-col space-y-4 p-4">
                  <h2 className="text-md font-semibold text-slate-900">
                    {t("environments.surveys.edit.follow_ups_modal_action_email_content")}
                  </h2>
                  <FormField
                    control={form.control}
                    name="subject"
                    render={({ field }) => {
                      return (
                        <FormItem>
                          <div className="flex flex-col space-y-2">
                            <FormLabel>
                              {t("environments.surveys.edit.follow_ups_modal_action_subject_label")}
                            </FormLabel>
                            <FormControl>
                              <Input
                                {...field}
                                className="max-w-80"
                                placeholder={t(
                                  "environments.surveys.edit.follow_ups_modal_action_subject_placeholder"
                                )}
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
                            <FormLabel
                              className={cn(
                                "font-medium",
                                formErrors.body ? "text-red-500" : "text-slate-700"
                              )}>
                              {t("environments.surveys.edit.follow_ups_modal_action_body_label")}
                            </FormLabel>
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
                                placeholder={t(
                                  "environments.surveys.edit.follow_ups_modal_action_body_placeholder"
                                )}
                                onEmptyChange={(isEmpty) => {
                                  if (isEmpty) {
                                    if (!formErrors.body) {
                                      form.setError("body", {
                                        type: "manual",
                                        message: "Body is required",
                                      });
                                    }
                                  } else {
                                    if (formErrors.body) {
                                      form.clearErrors("body");
                                    }
                                  }
                                }}
                                isInvalid={!!formErrors.body}
                              />
                            </FormControl>

                            {formErrors.body ? (
                              <div>
                                <span className="text-sm text-red-500">{formErrors.body.message}</span>
                              </div>
                            ) : null}
                          </div>
                        </FormItem>
                      );
                    }}
                  />

                  <FormField
                    control={form.control}
                    name="attachResponseData"
                    render={({ field }) => {
                      return (
                        <FormItem>
                          <div className="flex flex-col gap-2">
                            <div className="flex items-center space-x-2">
                              <Checkbox
                                id="attachResponseData"
                                checked={field.value}
                                defaultChecked={defaultValues?.attachResponseData ?? false}
                                onCheckedChange={(checked) => field.onChange(checked)}
                              />
                              <FormLabel htmlFor="attachResponseData" className="font-medium">
                                {t(
                                  "environments.surveys.edit.follow_ups_modal_action_attach_response_data_label"
                                )}
                              </FormLabel>
                            </div>

                            <FormDescription className="text-sm text-slate-500">
                              {t(
                                "environments.surveys.edit.follow_ups_modal_action_attach_response_data_description"
                              )}
                            </FormDescription>
                          </div>
                        </FormItem>
                      );
                    }}
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="absolute right-0 bottom-0 z-20 h-12 w-full bg-white p-2">
            <div className="flex justify-end space-x-2">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => {
                  setOpen(false);
                  form.reset();
                }}>
                {t("common.cancel")}
              </Button>

              <Button loading={formSubmitting} size="sm">
                {t("common.save")}
              </Button>
            </div>
          </div>
        </form>
      </FormProvider>
    </Modal>
  );
};
