"use client";

import { createOrUpdateIntegrationAction } from "@/app/(app)/environments/[environmentId]/integrations/actions";
import { BaseSelectDropdown } from "@/app/(app)/environments/[environmentId]/integrations/airtable/components/BaseSelectDropdown";
import { fetchTables } from "@/app/(app)/environments/[environmentId]/integrations/airtable/lib/airtable";
import AirtableLogo from "@/images/airtableLogo.svg";
import { getLocalizedValue } from "@/lib/i18n/utils";
import { replaceHeadlineRecall } from "@/lib/utils/recall";
import { AdditionalIntegrationSettings } from "@/modules/ui/components/additional-integration-settings";
import { Alert, AlertDescription, AlertTitle } from "@/modules/ui/components/alert";
import { Button } from "@/modules/ui/components/button";
import { Checkbox } from "@/modules/ui/components/checkbox";
import { Label } from "@/modules/ui/components/label";
import { Modal } from "@/modules/ui/components/modal";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/modules/ui/components/select";
import { useTranslate } from "@tolgee/react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { toast } from "react-hot-toast";
import { TIntegrationItem } from "@formbricks/types/integration";
import {
  TIntegrationAirtable,
  TIntegrationAirtableConfigData,
  TIntegrationAirtableInput,
  TIntegrationAirtableTables,
} from "@formbricks/types/integration/airtable";
import { TSurvey } from "@formbricks/types/surveys/types";

type EditModeProps =
  | { isEditMode: false; defaultData?: never }
  | { isEditMode: true; defaultData: IntegrationModalInputs & { index: number } };

type AddIntegrationModalProps = {
  open: boolean;
  setOpenWithStates: (v: boolean) => void;
  environmentId: string;
  airtableArray: TIntegrationItem[];
  surveys: TSurvey[];
  airtableIntegration: TIntegrationAirtable;
} & EditModeProps;

export type IntegrationModalInputs = {
  base: string;
  table: string;
  survey: string;
  questions: string[];
  includeVariables: boolean;
  includeHiddenFields: boolean;
  includeMetadata: boolean;
  includeCreatedAt: boolean;
};

const NoBaseFoundError = () => {
  const { t } = useTranslate();
  return (
    <Alert>
      <AlertTitle>{t("environments.integrations.airtable.no_bases_found")}</AlertTitle>
      <AlertDescription>{t("environments.integrations.airtable.please_create_a_base")}</AlertDescription>
    </Alert>
  );
};

export const AddIntegrationModal = ({
  open,
  setOpenWithStates,
  environmentId,
  airtableArray,
  surveys,
  airtableIntegration,
  isEditMode,
  defaultData,
}: AddIntegrationModalProps) => {
  const { t } = useTranslate();
  const router = useRouter();
  const [tables, setTables] = useState<TIntegrationAirtableTables["tables"]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const { handleSubmit, control, watch, setValue, reset } = useForm<IntegrationModalInputs>();
  const [includeHiddenFields, setIncludeHiddenFields] = useState(false);
  const [includeMetadata, setIncludeMetadata] = useState(false);
  const [includeCreatedAt, setIncludeCreatedAt] = useState(true);
  const airtableIntegrationData: TIntegrationAirtableInput = {
    type: "airtable",
    config: {
      key: airtableIntegration?.config?.key,
      data: airtableIntegration.config.data ?? [],
      email: airtableIntegration?.config?.email,
    },
  };

  useEffect(() => {
    if (isEditMode) {
      const { index: _index, ...rest } = defaultData;
      reset(rest);
      fetchTable(defaultData.base);
      setIncludeVariables(!!defaultData.includeVariables);
      setIncludeHiddenFields(!!defaultData.includeHiddenFields);
      setIncludeMetadata(!!defaultData.includeMetadata);
      setIncludeCreatedAt(!!defaultData.includeCreatedAt);
    } else {
      reset();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isEditMode]);

  const survey = watch("survey");
  const includeVariables = watch("includeVariables");

  const setIncludeVariables = (includeVariables: boolean) => {
    setValue("includeVariables", includeVariables);
  };

  const selectedSurvey = surveys.find((item) => item.id === survey);
  const submitHandler = async (data: IntegrationModalInputs) => {
    try {
      if (!data.base || data.base === "") {
        throw new Error(t("environments.integrations.airtable.please_select_a_base"));
      }

      if (!data.table || data.table === "") {
        throw new Error(t("environments.integrations.airtable.please_select_a_table"));
      }

      if (!selectedSurvey) {
        throw new Error(t("environments.integrations.please_select_a_survey_error"));
      }

      if (data.questions.length === 0) {
        throw new Error(t("environments.integrations.select_at_least_one_question_error"));
      }

      const currentTable = tables.find((item) => item.id === data.table);
      const integrationData: TIntegrationAirtableConfigData = {
        surveyId: selectedSurvey.id,
        surveyName: selectedSurvey.name,
        questionIds: data.questions,
        questions:
          data.questions.length === selectedSurvey.questions.length
            ? t("common.all_questions")
            : t("common.selected_questions"),
        createdAt: new Date(),
        baseId: data.base,
        tableId: data.table,
        tableName: currentTable?.name ?? "",
        includeVariables: data.includeVariables,
        includeHiddenFields,
        includeMetadata,
        includeCreatedAt,
      };

      if (isEditMode) {
        // update action
        airtableIntegrationData.config!.data[defaultData.index] = integrationData;
      } else {
        // create action
        airtableIntegrationData.config?.data.push(integrationData);
      }

      await createOrUpdateIntegrationAction({ environmentId, integrationData: airtableIntegrationData });
      if (isEditMode) {
        toast.success(t("environments.integrations.integration_updated_successfully"));
      } else {
        toast.success(t("environments.integrations.integration_added_successfully"));
      }
      handleClose();
    } catch (e) {
      toast.error(e.message);
    }
  };

  const handleTable = async (baseId: string) => {
    const data = await fetchTables(environmentId, baseId);

    if (data.tables) {
      setTables(data.tables);
    }
  };

  const fetchTable = async (val: string) => {
    setIsLoading(true);
    await handleTable(val);
    setIsLoading(false);
  };

  const handleClose = () => {
    reset();
    setOpenWithStates(false);
  };

  const handleDelete = async (index: number) => {
    try {
      const integrationData = structuredClone(airtableIntegrationData);
      integrationData.config.data.splice(index, 1);

      await createOrUpdateIntegrationAction({ environmentId, integrationData });
      handleClose();
      router.refresh();

      toast.success(t("environments.integrations.integration_removed_successfully"));
    } catch (e) {
      toast.error(e.message);
    }
  };

  return (
    <Modal open={open} setOpen={handleClose} noPadding>
      <div className="rounded-t-lg bg-slate-100">
        <div className="flex w-full items-center justify-between p-6">
          <div className="flex items-center space-x-2">
            <div className="mr-1.5 h-6 w-6 text-slate-500">
              <Image className="w-12" src={AirtableLogo} alt="Airtable logo" />
            </div>
            <div>
              <div className="text-xl font-medium text-slate-700">
                {t("environments.integrations.airtable.link_airtable_table")}
              </div>
              <div className="text-sm text-slate-500">
                {t("environments.integrations.airtable.sync_responses_with_airtable")}
              </div>
            </div>
          </div>
        </div>
      </div>
      <form onSubmit={handleSubmit(submitHandler)}>
        <div className="flex rounded-lg p-6">
          <div className="flex w-full flex-col gap-y-4 pt-5">
            {airtableArray.length ? (
              <BaseSelectDropdown
                control={control}
                isLoading={isLoading}
                fetchTable={fetchTable}
                airtableArray={airtableArray}
                setValue={setValue}
                defaultValue={defaultData?.base}
              />
            ) : (
              <NoBaseFoundError />
            )}

            <div className="flex w-full flex-col">
              <Label htmlFor="table">{t("environments.integrations.airtable.table_name")}</Label>
              <div className="mt-1 flex">
                <Controller
                  control={control}
                  name="table"
                  render={({ field }) => (
                    <Select
                      required
                      disabled={!tables.length}
                      onValueChange={(val) => {
                        field.onChange(val);
                      }}
                      defaultValue={defaultData?.table}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      {tables.length ? (
                        <SelectContent>
                          {tables.map((item) => (
                            <SelectItem key={item.id} value={item.id}>
                              {item.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      ) : null}
                    </Select>
                  )}
                />
              </div>
            </div>

            {surveys.length ? (
              <div className="flex w-full flex-col">
                <Label htmlFor="survey">{t("common.select_survey")}</Label>
                <div className="mt-1 flex">
                  <Controller
                    control={control}
                    name="survey"
                    render={({ field }) => (
                      <Select
                        required
                        onValueChange={(val) => {
                          field.onChange(val);
                          setValue("questions", []);
                        }}
                        defaultValue={defaultData?.survey}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {surveys.map((item) => (
                            <SelectItem key={item.id} value={item.id}>
                              {item.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  />
                </div>
              </div>
            ) : null}

            {!surveys.length ? (
              <p className="m-1 text-xs text-slate-500">
                {t("environments.integrations.create_survey_warning")}
              </p>
            ) : null}

            {survey && selectedSurvey && (
              <div className="space-y-4">
                <div>
                  <Label htmlFor="Surveys">{t("common.questions")}</Label>
                  <div className="mt-1 max-h-[15vh] overflow-y-auto rounded-lg border border-slate-200">
                    <div className="grid content-center rounded-lg bg-slate-50 p-3 text-left text-sm text-slate-900">
                      {replaceHeadlineRecall(selectedSurvey, "default")?.questions.map((question) => (
                        <Controller
                          key={question.id}
                          control={control}
                          name={"questions"}
                          render={({ field }) => (
                            <div className="my-1 flex items-center space-x-2">
                              <label htmlFor={question.id} className="flex cursor-pointer items-center">
                                <Checkbox
                                  type="button"
                                  id={question.id}
                                  value={question.id}
                                  className="bg-white"
                                  checked={field.value?.includes(question.id)}
                                  onCheckedChange={(checked) => {
                                    return checked
                                      ? field.onChange([...field.value, question.id])
                                      : field.onChange(field.value?.filter((value) => value !== question.id));
                                  }}
                                />
                                <span className="ml-2">
                                  {getLocalizedValue(question.headline, "default")}
                                </span>
                              </label>
                            </div>
                          )}
                        />
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

            <div className="flex justify-end gap-x-2">
              {isEditMode ? (
                <Button
                  onClick={async () => {
                    await handleDelete(defaultData.index);
                  }}
                  type="button"
                  loading={isLoading}
                  variant="destructive">
                  {t("common.delete")}
                </Button>
              ) : (
                <Button type="button" loading={isLoading} variant="ghost" onClick={handleClose}>
                  {t("common.cancel")}
                </Button>
              )}

              <Button type="submit">{t("common.save")}</Button>
            </div>
          </div>
        </div>
      </form>
    </Modal>
  );
};
