"use client";

import { createOrUpdateIntegrationAction } from "@/app/(app)/environments/[environmentId]/integrations/actions";
import { buildQuestionItems } from "@/app/(app)/environments/[environmentId]/integrations/lib/questionItems";
import PlainLogo from "@/images/plain.webp";
import { structuredClone } from "@/lib/pollyfills/structuredClone";
import { Button } from "@/modules/ui/components/button";
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
import { useTranslate } from "@tolgee/react";
import { PlusIcon, TrashIcon } from "lucide-react";
import Image from "next/image";
import React, { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import toast from "react-hot-toast";
import { TIntegrationInput } from "@formbricks/types/integration";
import {
  TIntegrationPlain,
  TIntegrationPlainConfigData,
  TPlainFieldType,
  TPlainMapping,
} from "@formbricks/types/integration/plain";
import { TSurvey, TSurveyQuestionTypeEnum } from "@formbricks/types/surveys/types";
import { INITIAL_MAPPING, PLAIN_FIELD_TYPES } from "../constants";

interface AddIntegrationModalProps {
  environmentId: string;
  surveys: TSurvey[];
  open: boolean;
  setOpen: React.Dispatch<React.SetStateAction<boolean>>;
  plainIntegration: TIntegrationPlain;
  selectedIntegration: (TIntegrationPlainConfigData & { index: number }) | null;
}

export const AddIntegrationModal = ({
  environmentId,
  surveys,
  open,
  setOpen,
  plainIntegration,
  selectedIntegration,
}: AddIntegrationModalProps) => {
  const { t } = useTranslate();
  const { handleSubmit } = useForm();
  const [selectedSurvey, setSelectedSurvey] = useState<TSurvey | null>(null);
  const [mapping, setMapping] = useState<
    {
      plainField: { id: string; name: string; type: TPlainFieldType; config?: Record<string, any> };
      question: { id: string; name: string; type: string };
      error?: {
        type: string;
        msg: React.ReactNode | string;
      } | null;
      isMandatory?: boolean;
    }[]
  >(INITIAL_MAPPING.map((m) => ({ ...m })));

  const [isDeleting, setIsDeleting] = useState<boolean>(false);
  const [isLinkingIntegration, setIsLinkingIntegration] = useState(false);

  const plainFieldTypes = PLAIN_FIELD_TYPES;

  // State to track custom label ID values
  const [labelIdValues, setLabelIdValues] = useState<Record<string, string>>({});

  const plainIntegrationData: TIntegrationInput = {
    type: "plain",
    config: {
      key: plainIntegration?.config?.key,
      data: plainIntegration.config?.data || [],
    },
  };

  const questionItems = useMemo(() => buildQuestionItems(selectedSurvey, t), [selectedSurvey?.id, t]);

  const checkContactInfoQuestion = (survey: TSurvey | null) => {
    if (!survey) return { hasContactInfo: false, missingFields: [] };

    // Find ContactInfo questions in the survey
    const contactInfoQuestions = survey.questions.filter(
      (q) => q.type === TSurveyQuestionTypeEnum.ContactInfo
    );

    if (contactInfoQuestions.length === 0) {
      return { hasContactInfo: false, missingFields: [] };
    }

    // Check if any ContactInfo question has all required fields enabled
    for (const question of contactInfoQuestions) {
      const contactQuestion = question as any; // Type assertion to access fields
      const missingFields: string[] = [];

      if (!contactQuestion.firstName?.show) {
        missingFields.push("firstName");
      }

      if (!contactQuestion.lastName?.show) {
        missingFields.push("lastName");
      }

      if (!contactQuestion.email?.show) {
        missingFields.push("email");
      }

      // If this question has all required fields, return success
      if (missingFields.length === 0) {
        return {
          hasContactInfo: true,
          missingFields: [],
          questionId: question.id,
          question: contactQuestion,
        };
      }

      // Otherwise continue checking other questions
    }

    // If we get here, we found ContactInfo questions but none with all required fields
    return {
      hasContactInfo: true,
      missingFields: ["firstName", "lastName", "email"],
      partialMatch: true,
    };
  };

  useEffect(() => {
    if (selectedIntegration) {
      setSelectedSurvey(
        surveys.find((survey) => {
          return survey.id === selectedIntegration.surveyId;
        })!
      );
      // Ensure mandatory fields remain protected from deletion when editing
      setMapping(
        selectedIntegration.mapping.map((m) => ({
          ...m,
          // Re-apply mandatory flag based on field id
          isMandatory: m.plainField.id === "threadTitle" || m.plainField.id === "componentText",
        }))
      );

      // Initialize labelIdValues from existing mapping
      const newLabelIdValues: Record<string, string> = {};
      selectedIntegration.mapping.forEach((m, idx) => {
        if (m.plainField.id === "labelTypeId") {
          newLabelIdValues[idx] = m.question.id;
        }
      });
      setLabelIdValues(newLabelIdValues);

      return;
    }
    resetForm();
  }, [selectedIntegration, surveys]);

  // State to track contact info validation results
  const [contactInfoValidation, setContactInfoValidation] = useState<{
    hasContactInfo: boolean;
    missingFields: string[];
    partialMatch?: boolean;
    questionId?: string;
    question?: any;
  }>({ hasContactInfo: false, missingFields: [] });

  // Check for ContactInfo question when survey is selected
  useEffect(() => {
    if (selectedSurvey) {
      const contactCheck = checkContactInfoQuestion(selectedSurvey);
      setContactInfoValidation(contactCheck);
    } else {
      setContactInfoValidation({ hasContactInfo: false, missingFields: [] });
    }
  }, [selectedSurvey]);

  const linkIntegration = async () => {
    try {
      if (!selectedSurvey) {
        throw new Error(t("environments.integrations.please_select_a_survey_error"));
      }

      const contactCheck = checkContactInfoQuestion(selectedSurvey);
      if (!contactCheck.hasContactInfo) {
        toast.error(t("environments.integrations.plain.no_contact_info_question"));
        return;
      } else if (contactCheck.partialMatch || contactCheck.missingFields.length > 0) {
        const missingFieldsFormatted = contactCheck.missingFields
          .map((field) => {
            switch (field) {
              case "firstName":
                return t("common.first_name");
              case "lastName":
                return t("common.last_name");
              case "email":
                return t("common.email");
              default:
                return field;
            }
          })
          .join(", ");

        toast.error(
          `${t("environments.integrations.plain.contact_info_missing_fields")} ${missingFieldsFormatted}.`
        );
        return;
      }

      if (mapping.length === 0 || (mapping.length === 1 && !mapping[0].question.id)) {
        throw new Error(t("environments.integrations.plain.please_select_at_least_one_mapping"));
      }

      if (mapping.filter((m) => m.error).length > 0) {
        throw new Error(t("environments.integrations.plain.please_resolve_mapping_errors"));
      }

      if (mapping.filter((m) => !m.question.id).length >= 1) {
        throw new Error(t("environments.integrations.plain.please_complete_mapping_fields"));
      }

      setIsLinkingIntegration(true);

      // Find Label ID mapping if it exists
      const labelIdMapping = mapping.find((m) => m.plainField.id === "labelTypeId");
      const labelId = labelIdMapping?.question.id || "";

      const integrationData: TIntegrationPlainConfigData = {
        surveyId: selectedSurvey.id,
        surveyName: selectedSurvey.name,
        mapping: mapping.map((m) => {
          const { error, ...rest } = m;
          return rest as TPlainMapping;
        }),
        includeCreatedAt: true,
        includeComponents: true,
        labelId: labelId, // Add the Label ID from the mapping
        createdAt: new Date(),
      };

      if (selectedIntegration) {
        // update action
        plainIntegrationData.config.data[selectedIntegration.index] = integrationData;
      } else {
        // create action
        plainIntegrationData.config.data.push(integrationData);
      }

      await createOrUpdateIntegrationAction({ environmentId, integrationData: plainIntegrationData });
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
      setIsLinkingIntegration(false);
    }
  };

  const deleteLink = async () => {
    plainIntegrationData.config.data.splice(selectedIntegration!.index, 1);
    try {
      setIsDeleting(true);
      await createOrUpdateIntegrationAction({ environmentId, integrationData: plainIntegrationData });
      toast.success(t("environments.integrations.integration_removed_successfully"));
      setOpen(false);
    } catch (error) {
      toast.error(error.message);
    } finally {
      setIsDeleting(false);
    }
  };

  const resetForm = () => {
    setIsLinkingIntegration(false);
    setSelectedSurvey(null);
    setLabelIdValues({});
    setMapping(INITIAL_MAPPING.map((m) => ({ ...m })));
  };

  const getFilteredQuestionItems = (selectedIdx) => {
    const selectedQuestionIds = mapping.filter((_, idx) => idx !== selectedIdx).map((m) => m.question.id);
    return questionItems.filter((q) => !selectedQuestionIds.includes(q.id));
  };

  const createCopy = (item) => structuredClone(item);

  const getFilteredPlainFieldTypes = (selectedIdx: number) => {
    const selectedPlainFieldIds = mapping.filter((_, idx) => idx !== selectedIdx).map((m) => m.plainField.id);

    return plainFieldTypes.filter((field) => !selectedPlainFieldIds.includes(field.id));
  };

  const MappingRow = ({ idx }: { idx: number }) => {
    const filteredQuestionItems = getFilteredQuestionItems(idx);
    const filteredPlainFields = getFilteredPlainFieldTypes(idx);

    const addRow = () => {
      const usedFieldIds = mapping.map((m) => m.plainField.id);
      const availableField = plainFieldTypes.find((field) => !usedFieldIds.includes(field.id)) || {
        id: "threadField",
        name: "Thread Field",
        type: "threadField" as TPlainFieldType,
      };

      setMapping((prev) => [
        ...prev,
        {
          plainField: availableField,
          question: { id: "", name: "", type: "" },
          isMandatory: false,
        },
      ]);
    };

    const deleteRow = () => {
      if (mapping[idx].isMandatory) return;

      setMapping((prev) => {
        return prev.filter((_, i) => i !== idx);
      });
    };

    interface ErrorMsgProps {
      error:
        | {
            type: string;
            msg: React.ReactNode | string;
          }
        | null
        | undefined;
      field?: { id: string; name: string; type: TPlainFieldType; config?: Record<string, any> };
      ques?: { id: string; name: string; type: string };
    }

    const ErrorMsg = ({ error }: ErrorMsgProps) => {
      if (!error) return null;

      return (
        <div className="my-4 w-full rounded-lg bg-red-100 p-4 text-sm text-red-800">
          <span className="mb-2 block">{error.type}</span>
          {error.msg}
        </div>
      );
    };

    return (
      <div className="w-full">
        <ErrorMsg
          key={idx}
          error={mapping[idx]?.error}
          field={mapping[idx].plainField}
          ques={mapping[idx].question}
        />
        <div className="flex w-full items-center space-x-2">
          <div className="flex w-full items-center">
            {mapping[idx].plainField.id === "labelTypeId" ? (
              <div className="max-w-full flex-1">
                <input
                  type="text"
                  className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none focus:ring-2 focus:ring-slate-200"
                  placeholder={t("environments.integrations.plain.enter_label_id")}
                  value={labelIdValues[idx] || ""}
                  onChange={(e) => {
                    setLabelIdValues((prev) => ({
                      ...prev,
                      [idx]: e.target.value,
                    }));
                    setMapping((prev) => {
                      const copy = createCopy(prev);
                      copy[idx] = {
                        ...copy[idx],
                        question: {
                          id: e.target.value,
                          name: "Label ID",
                          type: "labelTypeId",
                        },
                        error: null,
                      };
                      return copy;
                    });
                  }}
                />
              </div>
            ) : (
              // Regular question dropdown for non-Label ID fields
              <div className="max-w-full flex-1">
                <DropdownSelector
                  placeholder={t("environments.integrations.plain.select_a_survey_question")}
                  items={filteredQuestionItems}
                  selectedItem={mapping?.[idx]?.question}
                  setSelectedItem={(item) => {
                    setMapping((prev) => {
                      const copy = createCopy(prev);
                      copy[idx] = {
                        ...copy[idx],
                        question: item,
                        error: null,
                      };
                      return copy;
                    });
                  }}
                  disabled={questionItems.length === 0}
                />
              </div>
            )}
            <div className="h-px w-4 border-t border-t-slate-300" />
            <div className="max-w-full flex-1">
              <DropdownSelector
                placeholder={t("environments.integrations.plain.select_a_field_to_map")}
                items={filteredPlainFields}
                selectedItem={mapping?.[idx]?.plainField}
                disabled={filteredPlainFields.length === 0}
                setSelectedItem={(item) => {
                  setMapping((prev) => {
                    const copy = createCopy(prev);
                    copy[idx] = {
                      ...copy[idx],
                      plainField: item,
                      error: null,
                    };
                    return copy;
                  });
                }}
              />
            </div>
          </div>
          <div className="flex space-x-2">
            {!mapping[idx].isMandatory && (
              <Button variant="secondary" size="icon" className="size-10" onClick={deleteRow}>
                <TrashIcon />
              </Button>
            )}
            <Button variant="secondary" size="icon" className="size-10" onClick={addRow}>
              <PlusIcon />
            </Button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent>
        <DialogHeader>
          <div className="mb-4 flex items-start space-x-2">
            <div className="relative size-8">
              <Image
                fill
                className="object-contain object-center"
                src={PlainLogo}
                alt={t("environments.integrations.plain.plain_logo")}
              />
            </div>
            <div className="space-y-0.5">
              <DialogTitle>{t("environments.integrations.plain.configure_plain_integration")}</DialogTitle>
              <DialogDescription>
                {t("environments.integrations.plain.plain_integration_description")}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <form onSubmit={handleSubmit(linkIntegration)} className="contents space-y-4">
          <DialogBody>
            <div className="w-full space-y-4">
              <div>
                <div className="mb-4">
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

                  {/* Contact Info Validation Alerts */}
                  {selectedSurvey && (
                    <>
                      {/* Success – all required fields present */}
                      {contactInfoValidation.hasContactInfo &&
                        contactInfoValidation.missingFields.length === 0 && (
                          <div className="my-4 rounded-md bg-green-50 p-3 text-sm text-green-800">
                            <p className="font-medium">
                              {t("environments.integrations.plain.contact_info_success_title", {
                                defaultValue: "Contact-Info question found",
                              })}
                            </p>
                            <p className="mt-1">
                              {t("environments.integrations.plain.contact_info_all_present", {
                                defaultValue:
                                  "This survey contains a complete Contact-Info question (first name, last name & email).",
                              })}
                            </p>
                          </div>
                        )}

                      {/* Error – no contact info question */}
                      {!contactInfoValidation.hasContactInfo && (
                        <div className="mt-2 rounded-md bg-red-50 p-3 text-sm text-red-800">
                          <p className="font-medium">
                            {t("environments.integrations.plain.contact_info_missing_title", {
                              defaultValue: "No Contact-Info question",
                            })}
                          </p>
                          <p className="mt-1">
                            {t("environments.integrations.plain.no_contact_info_question", {
                              defaultValue:
                                "This survey does not include a Contact-Info question. Please add one with first name, last name and email enabled to use Plain.",
                            })}
                          </p>
                          <a
                            href="https://formbricks.com/docs/integrations/plain#contact-info"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="mt-2 inline-block text-xs font-medium underline">
                            {t("common.learn_more", { defaultValue: "Learn more" })}
                          </a>
                        </div>
                      )}

                      {/* Warning – partial match (retain existing implementation) */}
                      {contactInfoValidation.hasContactInfo && contactInfoValidation.partialMatch && (
                        <div className="mt-2 rounded-md bg-red-50 p-3 text-sm text-red-800">
                          <p className="font-medium">
                            {t("environments.integrations.plain.contact_info_warning")}
                          </p>
                          <p className="mt-1">
                            {t("environments.integrations.plain.contact_info_missing_fields_description")}:{" "}
                            {contactInfoValidation.missingFields
                              .map((field) => {
                                switch (field) {
                                  case "firstName":
                                    return t("common.first_name");
                                  case "lastName":
                                    return t("common.last_name");
                                  case "email":
                                    return t("common.email");
                                  default:
                                    return field;
                                }
                              })
                              .join(", ")}
                          </p>
                          <a
                            href="https://docs.formbricks.com/integrations/plain#contact-info"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="mt-2 inline-block text-xs font-medium underline">
                            {t("common.learn_more", { defaultValue: "Learn more" })}
                          </a>
                        </div>
                      )}
                    </>
                  )}
                </div>

                {selectedSurvey && (
                  <div className="space-y-4">
                    <div>
                      <Label>{t("environments.integrations.plain.map_formbricks_fields_to_plain")}</Label>
                      <p className="mt-1 text-xs text-slate-500">
                        {t("environments.integrations.plain.mandatory_mapping_note", {
                          defaultValue:
                            "Thread Title and Component Text are mandatory mappings and cannot be removed.",
                        })}
                      </p>
                      <div className="mt-1 space-y-2 overflow-y-auto">
                        {mapping.map((_, idx) => (
                          <MappingRow idx={idx} key={idx} />
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </DialogBody>

          <DialogFooter>
            {selectedIntegration ? (
              <Button
                type="button"
                variant="destructive"
                loading={isDeleting}
                onClick={() => {
                  deleteLink();
                }}>
                {t("common.delete")}
              </Button>
            ) : (
              <Button
                type="button"
                variant="secondary"
                onClick={() => {
                  setOpen(false);
                  resetForm();
                }}>
                {t("common.cancel")}
              </Button>
            )}
            <Button
              type="submit"
              loading={isLinkingIntegration}
              disabled={mapping.filter((m) => m.error).length > 0}>
              {selectedIntegration ? t("common.update") : t("environments.integrations.plain.connect")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
