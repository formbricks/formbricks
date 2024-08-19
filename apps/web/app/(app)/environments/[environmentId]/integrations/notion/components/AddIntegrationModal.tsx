import { createOrUpdateIntegrationAction } from "@/app/(app)/environments/[environmentId]/integrations/actions";
import {
  ERRORS,
  TYPE_MAPPING,
  UNSUPPORTED_TYPES_BY_NOTION,
} from "@/app/(app)/environments/[environmentId]/integrations/notion/constants";
import { questionTypes } from "@/app/lib/questions";
import NotionLogo from "@/images/notion.png";
import { PlusIcon, XIcon } from "lucide-react";
import Image from "next/image";
import React, { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import toast from "react-hot-toast";
import { getLocalizedValue } from "@formbricks/lib/i18n/utils";
import { structuredClone } from "@formbricks/lib/pollyfills/structuredClone";
import { replaceHeadlineRecall } from "@formbricks/lib/utils/recall";
import { TAttributeClass } from "@formbricks/types/attribute-classes";
import { TIntegrationInput } from "@formbricks/types/integration";
import {
  TIntegrationNotion,
  TIntegrationNotionConfigData,
  TIntegrationNotionDatabase,
} from "@formbricks/types/integration/notion";
import { TSurvey, TSurveyQuestionTypeEnum } from "@formbricks/types/surveys/types";
import { Button } from "@formbricks/ui/Button";
import { DropdownSelector } from "@formbricks/ui/DropdownSelector";
import { Label } from "@formbricks/ui/Label";
import { Modal } from "@formbricks/ui/Modal";

interface AddIntegrationModalProps {
  environmentId: string;
  surveys: TSurvey[];
  open: boolean;
  setOpen: React.Dispatch<React.SetStateAction<boolean>>;
  notionIntegration: TIntegrationNotion;
  databases: TIntegrationNotionDatabase[];
  selectedIntegration: (TIntegrationNotionConfigData & { index: number }) | null;
  attributeClasses: TAttributeClass[];
}

export const AddIntegrationModal = ({
  environmentId,
  surveys,
  open,
  setOpen,
  notionIntegration,
  databases,
  selectedIntegration,
  attributeClasses,
}: AddIntegrationModalProps) => {
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
      ? replaceHeadlineRecall(selectedSurvey, "default", attributeClasses)?.questions.map((q) => ({
          id: q.id,
          name: getLocalizedValue(q.headline, "default"),
          type: q.type,
        }))
      : [];

    const hiddenFields = selectedSurvey?.hiddenFields.enabled
      ? selectedSurvey?.hiddenFields.fieldIds?.map((fId) => ({
          id: fId,
          name: `Hidden field : ${fId}`,
          type: TSurveyQuestionTypeEnum.OpenText,
        })) || []
      : [];
    const Metadata = [
      {
        id: "metadata",
        name: `Metadata`,
        type: TSurveyQuestionTypeEnum.OpenText,
      },
    ];

    return [...questions, ...hiddenFields, ...Metadata];
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
        throw new Error("Please select a database");
      }
      if (!selectedSurvey) {
        throw new Error("Please select a survey");
      }

      if (mapping.length === 1 && (!mapping[0].question.id || !mapping[0].column.id)) {
        throw new Error("Please select at least one mapping");
      }

      if (mapping.filter((m) => m.error).length > 0) {
        throw new Error("Please resolve the mapping errors");
      }

      if (
        mapping.filter((m) => m.column.id && !m.question.id).length >= 1 ||
        mapping.filter((m) => m.question.id && !m.column.id).length >= 1
      ) {
        throw new Error("Please complete mapping fields with notion property");
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
      toast.success(`Integration ${selectedIntegration ? "updated" : "added"} successfully`);
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
      toast.success("Integration removed successfully");
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
                - <i>{col.name}</i> of type <b>{col.type}</b> is not supported by notion API. The data
                won&apos;t be reflected in your notion database.
              </>
            );
          case ERRORS.MAPPING:
            const question = questionTypes.find((qt) => qt.id === ques.type);
            if (!question) return null;
            return (
              <>
                - <i>&quot;{ques.name}&quot;</i> of type <b>{question.label}</b> can&apos;t be mapped to the
                column <i>&quot;{col.name}&quot;</i> of type <b>{col.type}</b>. Instead use column of type{" "}
                {""}
                <b>{TYPE_MAPPING[question.id].join(" ,")}.</b>
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
                placeholder="Select a survey question"
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
                placeholder="Select a field to map"
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
                <Image className="w-12" src={NotionLogo} alt="Google Sheet logo" />
              </div>
              <div>
                <div className="text-xl font-medium text-slate-700">Link Notion Database</div>
                <div className="text-sm text-slate-500">Sync responses with a Notion Database</div>
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
                    label="Select Database"
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
                      <strong>Warning:</strong> A connection with this database is live. Please make changes
                      with caution.
                    </p>
                  )}
                  <p className="m-1 text-xs text-slate-500">
                    {databases.length === 0 &&
                      "You have to create at least one database to be able to setup this integration"}
                  </p>
                </div>
                <div className="mb-4">
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
                {selectedDatabase && selectedSurvey && (
                  <div>
                    <Label>Map Formbricks fields to Notion property</Label>
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
                    setMapping([]);
                  }}>
                  Cancel
                </Button>
              )}
              <Button
                type="submit"
                loading={isLinkingDatabase}
                disabled={mapping.filter((m) => m.error).length > 0}>
                {selectedIntegration ? "Update" : "Link Database"}
              </Button>
            </div>
          </div>
        </form>
      </div>
    </Modal>
  );
};
