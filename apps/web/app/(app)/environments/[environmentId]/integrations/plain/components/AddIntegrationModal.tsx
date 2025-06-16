"use client";

import { createOrUpdateIntegrationAction } from "@/app/(app)/environments/[environmentId]/integrations/actions";
import PlainLogo from "@/images/plain.webp";
import { getLocalizedValue } from "@/lib/i18n/utils";
import { structuredClone } from "@/lib/pollyfills/structuredClone";
import { replaceHeadlineRecall } from "@/lib/utils/recall";
import { getQuestionTypes } from "@/modules/survey/lib/questions";
import { Button } from "@/modules/ui/components/button";
import { DropdownSelector } from "@/modules/ui/components/dropdown-selector";
import { Label } from "@/modules/ui/components/label";
import { Modal } from "@/modules/ui/components/modal";
import { useTranslate } from "@tolgee/react";
import { PlusIcon, XIcon } from "lucide-react";
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
  const [customerIdentifierField, setCustomerIdentifierField] = useState<
    "emailAddress" | "externalId" | "customerId"
  >("emailAddress");
  const [customerIdentifierQuestion, setCustomerIdentifierQuestion] = useState<{
    id: string;
    name: string;
    type: string;
  } | null>(null);
  const [titleTemplate, setTitleTemplate] = useState<string>("");
  const [titleQuestion, setTitleQuestion] = useState<{ id: string; name: string; type: string } | null>(null);
  const [mapping, setMapping] = useState<
    {
      question: { id: string; name: string; type: string };
      plainField: { id: string; name: string; type: TPlainFieldType; config?: Record<string, any> };
      error?: {
        type: string;
        msg: React.ReactNode | string;
      } | null;
    }[]
  >([
    {
      question: { id: "", name: "", type: "" },
      plainField: { id: "title", name: "Thread Title", type: "title" },
    },
    {
      question: { id: "", name: "", type: "" },
      plainField: {
        id: "customerIdentifier",
        name: "Customer Identifier (Email)",
        type: "customerIdentifier",
        config: { identifierType: "emailAddress" },
      },
    },
    {
      question: { id: "", name: "", type: "" },
      plainField: {
        id: "componentText",
        name: "Component Text",
        type: "componentText",
        config: { format: "text" },
      },
    },
  ]);
  const [isDeleting, setIsDeleting] = useState<boolean>(false);
  const [isLinkingDatabase, setIsLinkingDatabase] = useState(false);
  const integrationData: TIntegrationPlainConfigData = {
    surveyId: "",
    surveyName: "",
    mapping: [
      {
        question: { id: "", name: "", type: "" },
        plainField: { id: "title", name: "Thread Title", type: "title" },
      },
      {
        question: { id: "", name: "", type: "" },
        plainField: {
          id: "customerIdentifier",
          name: "Customer Identifier (Email)",
          type: "customerIdentifier",
          config: { identifierType: "emailAddress" },
        },
      },
      {
        question: { id: "", name: "", type: "" },
        plainField: {
          id: "componentText",
          name: "Component Text",
          type: "componentText",
          config: { format: "text" },
        },
      },
    ],
    createdAt: new Date(),
    customerIdentifierField: "emailAddress",
    includeCreatedAt: true,
    includeComponents: true,
    titleTemplate: "",
  };

  const plainIntegrationData: TIntegrationInput = {
    type: "plain",
    config: {
      key: plainIntegration?.config?.key,
      data: plainIntegration.config?.data || [],
    },
  };

  const handleSurveySelect = (survey: TSurvey) => {
    if (!survey) return;

    setSelectedSurvey(survey);

    // Reset mapping when survey changes but keep the essential fields
    setMapping([
      {
        question: { id: "", name: "", type: "" },
        plainField: { id: "title", name: "Thread Title", type: "title" },
      },
      {
        question: { id: "", name: "", type: "" },
        plainField: {
          id: "customerIdentifier",
          name: "Customer Identifier (Email)",
          type: "customerIdentifier",
          config: { identifierType: "emailAddress" },
        },
      },
      {
        question: { id: "", name: "", type: "" },
        plainField: {
          id: "componentText",
          name: "Component Text",
          type: "componentText",
          config: { format: "text" },
        },
      },
    ]);

    // Reset other fields
    setCustomerIdentifierQuestion(null);
    setTitleQuestion(null);
  };

  const questionItems = useMemo(() => {
    const questions = selectedSurvey
      ? replaceHeadlineRecall(selectedSurvey, "default")?.questions.map((q) => ({
          id: q.id,
          name: getLocalizedValue(q.headline, "default"),
          type: q.type,
        }))
      : [];

    const variables =
      selectedSurvey?.variables.map((variable) => ({
        id: variable.id,
        name: variable.name,
        type: TSurveyQuestionTypeEnum.OpenText,
      })) || [];

    const hiddenFields = selectedSurvey?.hiddenFields.enabled
      ? selectedSurvey?.hiddenFields.fieldIds?.map((fId) => ({
          id: fId,
          name: `${t("common.hidden_field")} : ${fId}`,
          type: TSurveyQuestionTypeEnum.OpenText,
        })) || []
      : [];
    const Metadata = [
      {
        id: "metadata",
        name: t("common.metadata"),
        type: TSurveyQuestionTypeEnum.OpenText,
      },
    ];
    const createdAt = [
      {
        id: "createdAt",
        name: t("common.created_at"),
        type: TSurveyQuestionTypeEnum.Date,
      },
    ];

    return [...questions, ...variables, ...hiddenFields, ...Metadata, ...createdAt];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedSurvey?.id]);

  useEffect(() => {
    if (selectedIntegration) {
      setSelectedSurvey(
        surveys.find((survey) => {
          return survey.id === selectedIntegration.surveyId;
        })!
      );
      setMapping(selectedIntegration.mapping);
      setCustomerIdentifierField(selectedIntegration.customerIdentifierField || "emailAddress");
      setTitleTemplate(selectedIntegration.titleTemplate || "");
      return;
    }
    resetForm();
  }, [selectedIntegration, surveys]);

  const linkDatabase = async () => {
    try {
      if (!selectedSurvey) {
        throw new Error(t("environments.integrations.please_select_a_survey_error"));
      }

      if (mapping.length === 1 && !mapping[0].question.id) {
        throw new Error(t("environments.integrations.plain.please_select_at_least_one_question"));
      }

      // Validate mapping before proceeding
      if (!validateMapping()) {
        throw new Error(t("environments.integrations.plain.please_resolve_mapping_errors"));
      }

      setIsLinkingDatabase(true);

      integrationData.surveyId = selectedSurvey.id;
      integrationData.surveyName = selectedSurvey.name;

      // Process mapping to ensure all fields have proper configuration
      integrationData.mapping = mapping
        .filter((m) => m.question.id && m.plainField.id) // Filter out incomplete mappings
        .map((m) => {
          // Create a new object without the error field
          const { error, ...mappingWithoutError } = m;

          // Ensure proper configuration for each field type
          if (
            mappingWithoutError.plainField.type === "threadField" &&
            mappingWithoutError.plainField.config
          ) {
            // Validate thread field configuration
            if (!mappingWithoutError.plainField.config.key) {
              mappingWithoutError.plainField.config.key = mappingWithoutError.question.name;
            }
          } else if (
            mappingWithoutError.plainField.type === "componentText" &&
            !mappingWithoutError.plainField.config
          ) {
            // Default configuration for component text
            mappingWithoutError.plainField.config = { format: "text" };
          }

          return mappingWithoutError;
        });

      integrationData.createdAt = new Date();
      integrationData.customerIdentifierField = customerIdentifierField;
      integrationData.titleTemplate = titleTemplate || undefined;

      // Add customer identifier question to mapping if selected
      if (customerIdentifierQuestion?.id) {
        const customerIdentifierMapping = {
          question: customerIdentifierQuestion,
          plainField: {
            id: "customerIdentifier",
            name: "Customer Identifier",
            type: "customerIdentifier" as TPlainFieldType,
            config: {
              identifierType: customerIdentifierField,
            },
          },
        };

        // Check if this question is already mapped
        const existingMapping = integrationData.mapping.find(
          (m) => m.question.id === customerIdentifierQuestion.id
        );
        if (!existingMapping) {
          integrationData.mapping.push(customerIdentifierMapping);
        }
      }

      // Add title question to mapping if selected
      if (titleQuestion?.id) {
        const titleMapping = {
          question: titleQuestion,
          plainField: {
            id: "title",
            name: "Thread Title",
            type: "title" as TPlainFieldType,
          },
        };

        // Check if this question is already mapped
        const existingMapping = integrationData.mapping.find((m) => m.question.id === titleQuestion.id);
        if (!existingMapping) {
          integrationData.mapping.push(titleMapping);
        }
      }

      if (selectedIntegration) {
        // update action
        plainIntegrationData.config!.data[selectedIntegration.index] = integrationData;
      } else {
        // create action
        plainIntegrationData.config!.data.push(integrationData);
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
      setIsLinkingDatabase(false);
    }
  };

  const deleteLink = async () => {
    plainIntegrationData.config!.data.splice(selectedIntegration!.index, 1);
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

  const validateMapping = () => {
    let hasError = false;
    const updatedMapping = mapping.map((m) => {
      if (!m.question.id) {
        m.error = { type: "question", msg: t("environments.integrations.plain.select_a_survey_question") };
        hasError = true;
      } else if (!m.plainField.id) {
        m.error = { type: "field", msg: t("environments.integrations.plain.select_a_plain_field") };
        hasError = true;
      } else {
        const plainFieldType = m.plainField.type;
        const questionType = m.question.type as TSurveyQuestionTypeEnum;
        if (
          PLAIN_TYPE_MAPPING[plainFieldType] &&
          !PLAIN_TYPE_MAPPING[plainFieldType].includes(questionType)
        ) {
          m.error = {
            type: "compatibility",
            msg: t("environments.integrations.plain.incompatible_field_type"),
          };
          hasError = true;
        } else {
          m.error = null;
        }
      }
      return m;
    });
    setMapping(updatedMapping);
    return !hasError;
  };

  const resetForm = () => {
    setIsLinkingDatabase(false);
    setSelectedSurvey(null);
    setCustomerIdentifierField("emailAddress");
    setTitleTemplate("");
    setMapping([
      {
        question: { id: "", name: "", type: "" },
        plainField: { id: "title", name: "Thread Title", type: "title" },
      },
      {
        question: { id: "", name: "", type: "" },
        plainField: {
          id: "customerIdentifier",
          name: "Customer Identifier (Email)",
          type: "customerIdentifier",
          config: { identifierType: "emailAddress" },
        },
      },
      {
        question: { id: "", name: "", type: "" },
        plainField: {
          id: "componentText",
          name: "Component Text",
          type: "componentText",
          config: { format: "text" },
        },
      },
    ]);
  };

  const getFilteredQuestionItems = (selectedIdx) => {
    const selectedQuestionIds = mapping.filter((_, idx) => idx !== selectedIdx).map((m) => m.question.id);

    return questionItems.filter((q) => !selectedQuestionIds.includes(q.id));
  };

  const createCopy = (item) => structuredClone(item);

  const MappingRow = ({ idx }: { idx: number }) => {
    const filteredQuestionItems = getFilteredQuestionItems(idx);

    const addRow = () => {
      setMapping((prev) => [
        ...prev,
        {
          question: { id: "", name: "", type: "" },
          plainField: { id: "componentText", name: "Component Text", type: "componentText" },
        },
      ]);
    };

    const deleteRow = () => {
      setMapping((prev) => {
        return prev.filter((_, i) => i !== idx);
      });
    };

    const ErrorMsg = ({ error }) => {
      if (!error) return null;

      return (
        <div className="my-4 w-full rounded-lg bg-red-100 p-4 text-sm text-red-800">
          <span className="mb-2 block">{error.type}</span>
          {error.msg}
        </div>
      );
    };

    // Get Plain field options, with special handling for customer identifier types
    const getPlainFieldOptions = () => {
      const baseOptions = [
        { id: "componentText", name: "Component Text", type: "componentText" },
        { id: "title", name: "Thread Title", type: "title" },
        { id: "threadField", name: "Thread Field", type: "threadField" },
        { id: "labelTypeId", name: "Label Type", type: "labelTypeId" },
      ];

      // Add customer identifier options with type information
      const customerIdentifierOptions = [
        {
          id: "customerIdentifier",
          name: "Customer Identifier (Email)",
          type: "customerIdentifier",
          identifierType: "emailAddress",
        },
        {
          id: "customerIdentifier",
          name: "Customer Identifier (External ID)",
          type: "customerIdentifier",
          identifierType: "externalId",
        },
        {
          id: "customerIdentifier",
          name: "Customer Identifier (User ID)",
          type: "customerIdentifier",
          identifierType: "customerId",
        },
      ];

      return [...baseOptions, ...customerIdentifierOptions];
    };

    return (
      <div className="mb-4 w-full">
        <ErrorMsg key={idx} error={mapping[idx]?.error} />
        <div className="flex w-full items-center">
          <div className="flex w-full items-center space-x-2">
            {/* Survey Question Dropdown */}
            <div className="w-[340px] max-w-full">
              <DropdownSelector
                placeholder={t("environments.integrations.plain.select_survey_question")}
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
              />
            </div>

            {/* Plain Field Dropdown */}
            <div className="w-[340px] max-w-full">
              <DropdownSelector
                placeholder={t("environments.integrations.plain.select_plain_field")}
                items={getPlainFieldOptions()}
                selectedItem={mapping?.[idx]?.plainField}
                setSelectedItem={(item) => {
                  setMapping((prev) => {
                    const copy = createCopy(prev);
                    let config = {};

                    // Initialize appropriate config based on field type
                    if (item.type === "threadField") {
                      config = {
                        key: "",
                        fieldType: "String",
                      };
                    } else if (item.type === "componentText") {
                      config = {
                        format: "text",
                      };
                    } else if (item.type === "customerIdentifier") {
                      config = {
                        identifierType: item.identifierType || "emailAddress",
                      };
                    }

                    copy[idx] = {
                      ...copy[idx],
                      plainField: {
                        id: item.id,
                        name: item.name,
                        type: item.type as TPlainFieldType,
                        config,
                      },
                      error: null,
                    };
                    return copy;
                  });
                }}
              />
            </div>
          </div>
          {mapping[idx]?.plainField?.type === "threadField" && (
            <div className="mt-2 flex w-full items-center space-x-2">
              <div className="w-1/2">
                <input
                  type="text"
                  className="block w-full rounded-md border border-slate-300 px-3 py-2 focus:border-slate-500 focus:outline-none focus:ring-slate-500 sm:text-sm"
                  placeholder="Thread field key"
                  value={mapping[idx]?.plainField?.config?.key || ""}
                  onChange={(e) => {
                    setMapping((prev) => {
                      const copy = createCopy(prev);
                      if (!copy[idx].plainField.config) {
                        copy[idx].plainField.config = {};
                      }
                      copy[idx].plainField.config.key = e.target.value;
                      return copy;
                    });
                  }}
                />
              </div>
              <div className="w-1/2">
                <DropdownSelector
                  placeholder="Field type"
                  items={[
                    { id: "String", name: "String" },
                    { id: "Enum", name: "Enum" },
                    { id: "Boolean", name: "Boolean" },
                  ]}
                  selectedItem={{
                    id: mapping[idx]?.plainField?.config?.fieldType || "String",
                    name: mapping[idx]?.plainField?.config?.fieldType || "String",
                  }}
                  setSelectedItem={(item) => {
                    setMapping((prev) => {
                      const copy = createCopy(prev);
                      if (!copy[idx].plainField.config) {
                        copy[idx].plainField.config = {};
                      }
                      copy[idx].plainField.config.fieldType = item.id;
                      return copy;
                    });
                  }}
                />
              </div>
            </div>
          )}
          {mapping[idx]?.plainField?.type === "labelTypeId" && (
            <div className="mt-2 w-full">
              <input
                type="text"
                className="block w-full rounded-md border border-slate-300 px-3 py-2 focus:border-slate-500 focus:outline-none focus:ring-slate-500 sm:text-sm"
                placeholder="Label Type ID"
                value={mapping[idx]?.plainField?.config?.labelId || ""}
                onChange={(e) => {
                  setMapping((prev) => {
                    const copy = createCopy(prev);
                    if (!copy[idx].plainField.config) {
                      copy[idx].plainField.config = {};
                    }
                    copy[idx].plainField.config.labelId = e.target.value;
                    return copy;
                  });
                }}
              />
            </div>
          )}
          <button
            type="button"
            className={`rounded-md p-1 hover:bg-slate-300 ${
              idx === mapping.length - 1 ? "visible" : "invisible"
            }`}
            onClick={addRow}>
            <PlusIcon className="h-5 w-5 font-bold text-slate-500" />
          </button>
          <button
            type="button"
            className={`flex-1 rounded-md p-1 hover:bg-red-100 ${
              mapping.length > 1 ? "visible" : "invisible"
            }`}
            onClick={deleteRow}>
            <XIcon className="h-5 w-5 text-red-500" />
          </button>
        </div>
      </div>
    );
  };

  const PLAIN_TYPE_MAPPING: Record<TPlainFieldType, TSurveyQuestionTypeEnum[]> = {
    componentText: [
      "openText",
      "multipleChoiceSingle",
      "multipleChoiceMulti",
      "rating",
      "nps",
      "cta",
      "consent",
      "email",
      "fileUpload",
      "pictureSelection",
      "cal",
      "date",
      "address",
      "number",
      "url",
      "phone",
      "dropdown",
      "matrix",
      "rankingQuestion",
      "textArea",
      "longText",
      "organization",
      "website",
      "boolean",
    ],
    title: [
      "openText",
      "multipleChoiceSingle",
      "multipleChoiceMulti",
      "rating",
      "nps",
      "cta",
      "consent",
      "email",
      "fileUpload",
      "pictureSelection",
      "cal",
      "date",
      "address",
      "number",
      "url",
      "phone",
      "dropdown",
      "matrix",
      "rankingQuestion",
      "textArea",
      "longText",
      "organization",
      "website",
      "boolean",
    ],
    customerIdentifier: ["email", "openText", "url", "phone"],
    threadField: [
      "openText",
      "multipleChoiceSingle",
      "multipleChoiceMulti",
      "rating",
      "nps",
      "cta",
      "consent",
      "email",
      "fileUpload",
      "pictureSelection",
      "cal",
      "date",
      "address",
      "number",
      "url",
      "phone",
      "dropdown",
      "matrix",
      "rankingQuestion",
      "textArea",
      "longText",
      "organization",
      "website",
      "boolean",
    ],
    labelTypeId: ["openText", "multipleChoiceSingle"],
    assignedTo: ["openText", "email"],
    tenantId: ["openText"],
  };

  return (
    <Modal open={open} setOpen={setOpen} noPadding closeOnOutsideClick={false} size="lg">
      <div className="flex h-full flex-col rounded-lg">
        <div className="rounded-t-lg bg-slate-100">
          <div className="flex w-full items-center justify-between p-6">
            <div className="flex items-center space-x-2">
              <div className="mr-1.5 h-6 w-6 text-slate-500">
                <Image
                  className="w-12"
                  src={PlainLogo}
                  alt={t("environments.integrations.plain.plain_logo")}
                />
              </div>
              <div>
                <div className="text-xl font-medium text-slate-700">
                  {t("environments.integrations.plain.add_plain_integration")}
                </div>
                <div className="text-sm text-slate-500">
                  {t("environments.integrations.plain.sync_responses_with_plain")}
                </div>
              </div>
            </div>
          </div>
        </div>
        <form onSubmit={handleSubmit(linkDatabase)} className="w-full">
          <div className="flex justify-between rounded-lg p-6">
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
                </div>

                {selectedSurvey && (
                  <div>
                    <Label>{t("environments.integrations.plain.select_survey_questions_to_include")}</Label>
                    <div className="mt-4 max-h-[20vh] w-full overflow-y-auto">
                      {mapping.map((_, idx) => (
                        <MappingRow idx={idx} key={idx} />
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
          <div className="flex justify-end border-t border-slate-200 p-6">
            <div className="flex space-x-2">
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
                  variant="ghost"
                  onClick={() => {
                    setOpen(false);
                    resetForm();
                    setMapping([]);
                  }}>
                  {t("common.cancel")}
                </Button>
              )}
              <Button
                type="submit"
                loading={isLinkingDatabase}
                disabled={mapping.filter((m) => m.error).length > 0}>
                {selectedIntegration ? t("common.update") : t("environments.integrations.plain.link_survey")}
              </Button>
            </div>
          </div>
        </form>
      </div>
    </Modal>
  );
};
