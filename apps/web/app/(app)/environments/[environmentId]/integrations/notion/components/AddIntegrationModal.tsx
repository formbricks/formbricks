"use client";

import { createOrUpdateIntegrationAction } from "@/app/(app)/environments/[environmentId]/integrations/actions";
import {
  ERRORS,
  TYPE_MAPPING,
  UNSUPPORTED_TYPES_BY_NOTION,
} from "@/app/(app)/environments/[environmentId]/integrations/notion/constants";
import NotionLogo from "@/images/notion.png";
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
  TIntegrationNotion,
  TIntegrationNotionConfigData,
  TIntegrationNotionDatabase,
} from "@formbricks/types/integration/notion";
import { TSurvey, TSurveyQuestionTypeEnum } from "@formbricks/types/surveys/types";

interface AddIntegrationModalProps {
  environmentId: string;
  surveys: TSurvey[];
  open: boolean;
  setOpen: React.Dispatch<React.SetStateAction<boolean>>;
  notionIntegration: TIntegrationNotion;
  databases: TIntegrationNotionDatabase[];
  selectedIntegration: (TIntegrationNotionConfigData & { index: number }) | null;
}

export const AddIntegrationModal = ({
  environmentId,
  surveys,
  open,
  setOpen,
  notionIntegration,
  databases,
  selectedIntegration,
}: AddIntegrationModalProps) => {
  const { t } = useTranslate();
  const { handleSubmit } = useForm();
  const [selectedDatabase, setSelectedDatabase] = useState<TIntegrationNotionDatabase | null>();
  const [selectedSurvey, setSelectedSurvey] = useState<TSurvey | null>(null);
  const [mapping, setMapping] = useState<
    {
      column: { id: string; name: string; type: string };
      question: { id: string; name: string; type: string };
      error?: {
        type: string;
        msg: React.ReactNode | string;
      } | null;
    }[]
  >([
    {
      column: { id: "", name: "", type: "" },
      question: { id: "", name: "", type: "" },
    },
  ]);
  const [isDeleting, setIsDeleting] = useState<boolean>(false);
  const [isLinkingDatabase, setIsLinkingDatabase] = useState(false);
  const integrationData = {
    databaseId: "",
    databaseName: "",
    surveyId: "",
    surveyName: "",
    mapping: [
      {
        column: { id: "", name: "", type: "" },
        question: { id: "", name: "", type: "" },
      },
    ],
    createdAt: new Date(),
  };

  const notionIntegrationData: TIntegrationInput = {
    type: "notion",
    config: {
      key: notionIntegration?.config?.key,
      data: notionIntegration.config?.data || [],
    },
  };

  const hasMatchingId = notionIntegration.config.data.some((configData) => {
    if (!selectedDatabase) {
      return false;
    }
    return configData.databaseId === selectedDatabase.id;
  });

  const dbItems = useMemo(() => {
    const dbProperties = (selectedDatabase as any)?.properties;
    return (
      Object.keys(dbProperties || {}).map((fieldKey: string) => ({
        id: dbProperties[fieldKey].id,
        name: dbProperties[fieldKey].name,
        type: dbProperties[fieldKey].type,
      })) || []
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDatabase?.id]);

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
      const selectedDB = databases.find((db) => db.id === selectedIntegration.databaseId)!;
      if (selectedDB) {
        setSelectedDatabase({
          id: selectedDB.id,
          name: (selectedDB as any).title?.[0]?.plain_text,
          properties: selectedDB.properties,
        });
      }
      setSelectedSurvey(
        surveys.find((survey) => {
          return survey.id === selectedIntegration.surveyId;
        })!
      );
      setMapping(selectedIntegration.mapping);
      return;
    }
    resetForm();
  }, [selectedIntegration, surveys, databases]);

  const linkDatabase = async () => {
    try {
      if (!selectedDatabase) {
        throw new Error(t("environments.integrations.notion.please_select_a_database"));
      }
      if (!selectedSurvey) {
        throw new Error(t("environments.integrations.please_select_a_survey_error"));
      }

      if (mapping.length === 1 && (!mapping[0].question.id || !mapping[0].column.id)) {
        throw new Error(t("environments.integrations.notion.please_select_at_least_one_mapping"));
      }

      if (mapping.filter((m) => m.error).length > 0) {
        throw new Error(t("environments.integrations.notion.please_resolve_mapping_errors"));
      }

      if (
        mapping.filter((m) => m.column.id && !m.question.id).length >= 1 ||
        mapping.filter((m) => m.question.id && !m.column.id).length >= 1
      ) {
        throw new Error(
          t("environments.integrations.notion.please_complete_mapping_fields_with_notion_property")
        );
      }

      setIsLinkingDatabase(true);

      integrationData.databaseId = selectedDatabase.id;
      integrationData.databaseName = selectedDatabase.name;
      integrationData.surveyId = selectedSurvey.id;
      integrationData.surveyName = selectedSurvey.name;
      integrationData.mapping = mapping.map((m) => {
        delete m.error;
        return m;
      });
      integrationData.createdAt = new Date();

      if (selectedIntegration) {
        // update action
        notionIntegrationData.config!.data[selectedIntegration.index] = integrationData;
      } else {
        // create action
        notionIntegrationData.config!.data.push(integrationData);
      }

      await createOrUpdateIntegrationAction({ environmentId, integrationData: notionIntegrationData });
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
    notionIntegrationData.config!.data.splice(selectedIntegration!.index, 1);
    try {
      setIsDeleting(true);
      await createOrUpdateIntegrationAction({ environmentId, integrationData: notionIntegrationData });
      toast.success(t("environments.integrations.integration_removed_successfully"));
      setOpen(false);
    } catch (error) {
      toast.error(error.message);
    } finally {
      setIsDeleting(false);
    }
  };

  const resetForm = () => {
    setIsLinkingDatabase(false);
    setSelectedDatabase(null);
    setSelectedSurvey(null);
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
          column: { id: "", name: "", type: "" },
          question: { id: "", name: "", type: "" },
        },
      ]);
    };

    const deleteRow = () => {
      setMapping((prev) => {
        return prev.filter((_, i) => i !== idx);
      });
    };

    const ErrorMsg = ({ error, col, ques }) => {
      const showErrorMsg = useMemo(() => {
        switch (error?.type) {
          case ERRORS.UNSUPPORTED_TYPE:
            return (
              <>
                -{" "}
                {t("environments.integrations.notion.col_name_of_type_is_not_supported", {
                  col_name: col.name,
                  type: col.type,
                })}
              </>
            );
          case ERRORS.MAPPING:
            const question = getQuestionTypes(t).find((qt) => qt.id === ques.type);
            if (!question) return null;
            return (
              <>
                {t("environments.integrations.notion.que_name_of_type_cant_be_mapped_to", {
                  que_name: ques.name,
                  question_label: question.label,
                  col_name: col.name,
                  col_type: col.type,
                  mapped_type: TYPE_MAPPING[question.id].join(" ,"),
                })}
              </>
            );
          default:
            return null;
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
      }, [error]);

      if (!error) return null;

      return (
        <div className="my-4 w-full rounded-lg bg-red-100 p-4 text-sm text-red-800">
          <span className="mb-2 block">{error.type}</span>
          {showErrorMsg}
        </div>
      );
    };

    const getFilteredDbItems = () => {
      const colMapping = mapping.map((m) => m.column.id);
      return dbItems.filter((item) => !colMapping.includes(item.id));
    };

    return (
      <div className="w-full">
        <ErrorMsg
          key={idx}
          error={mapping[idx]?.error}
          col={mapping[idx].column}
          ques={mapping[idx].question}
        />
        <div className="flex w-full items-center">
          <div className="flex w-full items-center">
            <div className="w-[340px] max-w-full">
              <DropdownSelector
                placeholder={t("environments.integrations.notion.select_a_survey_question")}
                items={filteredQuestionItems}
                selectedItem={mapping?.[idx]?.question}
                setSelectedItem={(item) => {
                  setMapping((prev) => {
                    const copy = createCopy(prev);
                    const col = copy[idx].column;
                    if (col.id) {
                      if (UNSUPPORTED_TYPES_BY_NOTION.includes(col.type)) {
                        copy[idx] = {
                          ...copy[idx],
                          error: {
                            type: ERRORS.UNSUPPORTED_TYPE,
                          },
                          question: item,
                        };
                        return copy;
                      }

                      const isValidColType = TYPE_MAPPING[item.type].includes(col.type);
                      if (!isValidColType) {
                        copy[idx] = {
                          ...copy[idx],
                          error: {
                            type: ERRORS.MAPPING,
                          },
                          question: item,
                        };
                        return copy;
                      }
                    }

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
            <div className="h-px w-4 border-t border-t-slate-300" />
            <div className="w-[340px] max-w-full">
              <DropdownSelector
                placeholder={t("environments.integrations.notion.select_a_field_to_map")}
                items={getFilteredDbItems()}
                selectedItem={mapping?.[idx]?.column}
                setSelectedItem={(item) => {
                  setMapping((prev) => {
                    const copy = createCopy(prev);
                    const ques = copy[idx].question;
                    if (ques.id) {
                      const isValidQuesType = TYPE_MAPPING[ques.type].includes(item.type);

                      if (UNSUPPORTED_TYPES_BY_NOTION.includes(item.type)) {
                        copy[idx] = {
                          ...copy[idx],
                          error: {
                            type: ERRORS.UNSUPPORTED_TYPE,
                          },
                          column: item,
                        };
                        return copy;
                      }

                      if (!isValidQuesType) {
                        copy[idx] = {
                          ...copy[idx],
                          error: {
                            type: ERRORS.MAPPING,
                          },
                          column: item,
                        };
                        return copy;
                      }
                    }
                    copy[idx] = {
                      ...copy[idx],
                      column: item,
                      error: null,
                    };
                    return copy;
                  });
                }}
                disabled={dbItems.length === 0}
              />
            </div>
          </div>
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

  return (
    <Modal open={open} setOpen={setOpen} noPadding closeOnOutsideClick={false} size="lg">
      <div className="flex h-full flex-col rounded-lg">
        <div className="rounded-t-lg bg-slate-100">
          <div className="flex w-full items-center justify-between p-6">
            <div className="flex items-center space-x-2">
              <div className="mr-1.5 h-6 w-6 text-slate-500">
                <Image
                  className="w-12"
                  src={NotionLogo}
                  alt={t("environments.integrations.notion.notion_logo")}
                />
              </div>
              <div>
                <div className="text-xl font-medium text-slate-700">
                  {t("environments.integrations.notion.link_notion_database")}
                </div>
                <div className="text-sm text-slate-500">
                  {t("environments.integrations.notion.sync_responses_with_a_notion_database")}
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
                    label={t("environments.integrations.notion.select_a_database")}
                    items={databases.map((d) => ({
                      id: d.id,
                      name: (d as any).title?.[0]?.plain_text,
                      properties: d.properties,
                    }))}
                    selectedItem={selectedDatabase}
                    setSelectedItem={setSelectedDatabase}
                    disabled={databases.length === 0}
                  />
                  {selectedDatabase && hasMatchingId && (
                    <p className="text-xs text-amber-700">
                      <strong>{t("common.warning")}:</strong>{" "}
                      {t("environments.integrations.notion.duplicate_connection_warning")}
                    </p>
                  )}
                  <p className="m-1 text-xs text-slate-500">
                    {databases.length === 0 &&
                      t(
                        "environments.integrations.notion.create_at_least_one_database_to_setup_this_integration"
                      )}
                  </p>
                </div>
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
                {selectedDatabase && selectedSurvey && (
                  <div>
                    <Label>
                      {t("environments.integrations.notion.map_formbricks_fields_to_notion_property")}
                    </Label>
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
                {selectedIntegration
                  ? t("common.update")
                  : t("environments.integrations.notion.link_database")}
              </Button>
            </div>
          </div>
        </form>
      </div>
    </Modal>
  );
};
