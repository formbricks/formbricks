"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2Icon, PlusIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import toast from "react-hot-toast";
import { useTranslation } from "react-i18next";
import { TConnectorType, UNSUPPORTED_CONNECTOR_ELEMENT_TYPES } from "@formbricks/types/connector";
import {
  getResponseCountAction,
  importCsvDataAction,
  importHistoricalResponsesAction,
} from "@/lib/connector/actions";
import { getFormattedErrorMessage } from "@/lib/utils/helper";
import { Alert } from "@/modules/ui/components/alert";
import { Button } from "@/modules/ui/components/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/modules/ui/components/dialog";
import {
  FormControl,
  FormError,
  FormField,
  FormItem,
  FormLabel,
  FormProvider,
} from "@/modules/ui/components/form";
import { Input } from "@/modules/ui/components/input";
import { Label } from "@/modules/ui/components/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/modules/ui/components/select";
import { Switch } from "@/modules/ui/components/switch";
import {
  TCreateConnectorStep,
  TFieldMapping,
  TFormbricksConnectorForm,
  TSourceField,
  TUnifySurvey,
  ZFormbricksConnectorForm,
} from "../types";
import {
  TConnectorOptionId,
  TEnumValidationError,
  areAllRequiredFieldsMapped,
  isConnectorNameValid,
  parseCSVColumnsToFields,
  toggleQuestionId,
  validateEnumMappings,
} from "../utils";
import { ConnectorTypeSelector } from "./connector-type-selector";
import { CsvConnectorUI } from "./csv-connector-ui";
import { FormbricksQuestionList } from "./formbricks-question-list";

interface CreateConnectorModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  showTrigger?: boolean;
  onCreateConnector: (data: {
    name: string;
    type: TConnectorType;
    feedbackDirectoryId: string;
    surveyMappings?: { surveyId: string; elementIds: string[] }[];
    fieldMappings?: TFieldMapping[];
  }) => Promise<string | undefined>;
  surveys: TUnifySurvey[];
  workspaceId: string;
  directories: { id: string; name: string }[];
}

const getDialogTitle = (
  step: TCreateConnectorStep,
  type: TConnectorOptionId | null,
  t: (key: string) => string
): string => {
  if (step === "selectType") return t("workspace.unify.add_feedback_source");
  if (type === "formbricks_survey") return t("workspace.unify.select_survey_and_questions");
  if (type === "csv") return t("workspace.unify.import_csv_data");
  return t("workspace.unify.configure_mapping");
};

const getDialogDescription = (
  step: TCreateConnectorStep,
  type: TConnectorOptionId | null,
  t: (key: string) => string
): string => {
  if (step === "selectType") return t("workspace.unify.select_source_type_description");
  if (type === "formbricks_survey") return t("workspace.unify.select_survey_questions_description");
  if (type === "csv") return t("workspace.unify.upload_csv_data_description");
  return t("workspace.unify.configure_mapping");
};

const getNextStepButtonLabel = (type: TConnectorOptionId | null, t: (key: string) => string): string => {
  if (type === "formbricks_survey") return t("workspace.unify.select_questions");
  if (type === "csv") return t("workspace.unify.configure_import");
  if (type === "api_ingestion") return t("workspace.unify.api_ingestion_manage_api_keys");
  if (type === "feedback_record_mcp") return t("common.learn_more");
  return t("workspace.unify.create_mapping");
};

const getSelectableQuestionIds = (survey: TUnifySurvey): string[] =>
  survey.elements
    .filter((element) => !(UNSUPPORTED_CONNECTOR_ELEMENT_TYPES as readonly string[]).includes(element.type))
    .map((element) => element.id);

export const CreateConnectorModal = ({
  open,
  onOpenChange,
  showTrigger = true,
  onCreateConnector,
  surveys,
  workspaceId,
  directories,
}: CreateConnectorModalProps) => {
  const { t } = useTranslation();
  const router = useRouter();

  const defaultConnectorName = useMemo<Record<TConnectorType, string>>(
    () => ({
      formbricks_survey: t("workspace.unify.default_connector_name_formbricks"),
      csv: t("workspace.unify.default_connector_name_csv"),
    }),
    [t]
  );

  const formbricksForm = useForm<TFormbricksConnectorForm>({
    resolver: zodResolver(ZFormbricksConnectorForm),
    defaultValues: {
      sourceName: defaultConnectorName.formbricks_survey,
      surveyId: "",
      selectedQuestionIds: [],
      importHistorical: true,
    },
    mode: "onChange",
  });

  const [currentStep, setCurrentStep] = useState<TCreateConnectorStep>("selectType");
  const [selectedType, setSelectedType] = useState<TConnectorOptionId | null>(null);
  const [mappings, setMappings] = useState<TFieldMapping[]>([]);
  const [sourceFields, setSourceFields] = useState<TSourceField[]>([]);
  const [csvParsedData, setCsvParsedData] = useState<Record<string, string>[]>([]);
  const [enumValidationErrors, setEnumValidationErrors] = useState<TEnumValidationError[]>([]);
  const [csvConnectorName, setCsvConnectorName] = useState("");
  const [responseCountBySurvey, setResponseCountBySurvey] = useState<Record<string, number | null>>({});
  const [isImporting, setIsImporting] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [selectedDirectoryId, setSelectedDirectoryId] = useState<string | null>(directories[0]?.id ?? null);

  const formbricksValues = formbricksForm.watch();
  const selectedSurveyId = formbricksValues.surveyId;
  const selectedQuestionIds = formbricksValues.selectedQuestionIds ?? [];

  const selectedSurvey = useMemo(
    () => surveys.find((survey) => survey.id === selectedSurveyId) ?? null,
    [surveys, selectedSurveyId]
  );

  const selectedSurveyResponseCount =
    selectedSurveyId && responseCountBySurvey[selectedSurveyId] !== undefined
      ? responseCountBySurvey[selectedSurveyId]
      : null;

  const fetchResponseCount = useCallback(
    async (surveyId: string) => {
      if (responseCountBySurvey[surveyId] !== undefined) return;
      try {
        const result = await getResponseCountAction({ surveyId, workspaceId });
        if (result?.data !== undefined) {
          setResponseCountBySurvey((prev) => ({ ...prev, [surveyId]: result.data ?? null }));
        }
      } catch {
        setResponseCountBySurvey((prev) => ({ ...prev, [surveyId]: null }));
      }
    },
    [responseCountBySurvey, workspaceId]
  );

  useEffect(() => {
    if (selectedSurveyId && currentStep === "mapping" && selectedType === "formbricks_survey") {
      fetchResponseCount(selectedSurveyId);
    }
  }, [currentStep, fetchResponseCount, selectedSurveyId, selectedType]);

  useEffect(() => {
    if (currentStep !== "mapping" || selectedType !== "formbricks_survey" || !selectedSurveyId) {
      return;
    }

    const survey = surveys.find((item) => item.id === selectedSurveyId);
    const supportedElementIds = survey ? getSelectableQuestionIds(survey) : [];

    formbricksForm.setValue("selectedQuestionIds", supportedElementIds, {
      shouldDirty: true,
      shouldValidate: true,
    });
    formbricksForm.setValue("importHistorical", true, {
      shouldDirty: true,
    });
  }, [currentStep, formbricksForm, selectedSurveyId, selectedType, surveys]);

  const resetForm = () => {
    setCurrentStep("selectType");
    setSelectedType(null);
    formbricksForm.reset({
      sourceName: defaultConnectorName.formbricks_survey,
      surveyId: "",
      selectedQuestionIds: [],
      importHistorical: true,
    });
    setMappings([]);
    setSourceFields([]);
    setCsvParsedData([]);
    setEnumValidationErrors([]);
    setResponseCountBySurvey({});
    setCsvConnectorName("");
    setIsImporting(false);
    setIsCreating(false);
    setSelectedDirectoryId(directories[0]?.id ?? null);
  };

  const handleOpenChange = (newOpen: boolean) => {
    if (isImporting) return;
    if (!newOpen) resetForm();
    onOpenChange(newOpen);
  };

  const handleNextStep = () => {
    if (currentStep !== "selectType" || !selectedType) return;

    if (selectedType === "api_ingestion") {
      handleOpenChange(false);
      router.push(`/workspaces/${workspaceId}/settings/organization/api-keys`);
      return;
    }

    if (selectedType === "feedback_record_mcp") {
      window.open("https://formbricks.com/docs", "_blank", "noopener,noreferrer");
      return;
    }

    if (selectedType === "formbricks_survey") {
      formbricksForm.reset({
        sourceName: defaultConnectorName.formbricks_survey,
        surveyId: "",
        selectedQuestionIds: [],
        importHistorical: true,
      });
    }

    if (selectedType === "csv") {
      setCsvConnectorName(defaultConnectorName.csv);
    }

    setCurrentStep("mapping");
  };

  const handleBack = () => {
    if (currentStep === "mapping") {
      setCurrentStep("selectType");
      setMappings([]);
      setSourceFields([]);
      setEnumValidationErrors([]);
    }
  };

  const handleHistoricalImport = async (connectorId: string, surveyId: string) => {
    const responseCount = responseCountBySurvey[surveyId] ?? 0;
    if (responseCount <= 0) return;
    setIsImporting(true);
    const importResult = await importHistoricalResponsesAction({
      connectorId,
      workspaceId,
      surveyId,
    });
    setIsImporting(false);

    if (importResult?.data) {
      toast.success(
        t("workspace.unify.historical_import_complete", {
          successes: importResult.data.successes,
          failures: importResult.data.failures,
          skipped: importResult.data.skipped,
        })
      );
    } else {
      toast.error(getFormattedErrorMessage(importResult));
    }
  };

  const handleCsvImport = async (connectorId: string) => {
    setIsImporting(true);
    const importResult = await importCsvDataAction({
      connectorId,
      workspaceId,
      csvData: csvParsedData,
    });
    setIsImporting(false);

    if (importResult?.data) {
      toast.success(
        t("workspace.unify.csv_import_complete", {
          successes: importResult.data.successes,
          failures: importResult.data.failures,
          skipped: importResult.data.skipped,
        })
      );
    } else {
      toast.error(getFormattedErrorMessage(importResult));
    }
  };

  const handleFormbricksQuestionToggle = (questionId: string) => {
    const nextSelection = toggleQuestionId(formbricksForm.getValues("selectedQuestionIds"), questionId);
    formbricksForm.setValue("selectedQuestionIds", nextSelection, {
      shouldDirty: true,
      shouldValidate: true,
    });
  };

  const handleCreateFormbricksConnector = async (values: TFormbricksConnectorForm) => {
    if (!selectedDirectoryId) return;
    setIsCreating(true);

    const connectorId = await onCreateConnector({
      name: values.sourceName.trim(),
      type: "formbricks_survey",
      feedbackDirectoryId: selectedDirectoryId,
      surveyMappings: [{ surveyId: values.surveyId, elementIds: values.selectedQuestionIds }],
    });

    if (connectorId && values.importHistorical) {
      await handleHistoricalImport(connectorId, values.surveyId);
    }

    setIsCreating(false);
    resetForm();
    onOpenChange(false);
  };

  const handleCreateCsvConnector = async () => {
    if (!selectedDirectoryId || !isConnectorNameValid(csvConnectorName)) return;
    if (csvParsedData.length > 0) {
      const errors = validateEnumMappings(mappings, csvParsedData);
      if (errors.length > 0) {
        setEnumValidationErrors(errors);
        return;
      }
      setEnumValidationErrors([]);
    }

    setIsCreating(true);

    const connectorId = await onCreateConnector({
      name: csvConnectorName.trim(),
      type: "csv",
      feedbackDirectoryId: selectedDirectoryId,
      fieldMappings: mappings.length > 0 ? mappings : undefined,
    });

    if (connectorId && csvParsedData.length > 0) {
      await handleCsvImport(connectorId);
    }

    setIsCreating(false);
    resetForm();
    onOpenChange(false);
  };

  const isCsvValid = selectedType === "csv" && sourceFields.length > 0;
  const areCsvRequiredFieldsMapped = areAllRequiredFieldsMapped(mappings);

  const handleLoadSourceFields = () => {
    if (selectedType === "csv") {
      const fields = parseCSVColumnsToFields("timestamp,customer_id,rating,feedback_text,category");
      setSourceFields(fields);
    }
  };

  return (
    <>
      {showTrigger && (
        <Button onClick={() => onOpenChange(true)} size="sm">
          {t("workspace.unify.add_source")}
          <PlusIcon className="ml-2 h-4 w-4" />
        </Button>
      )}

      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent className="max-w-3xl">
          {isImporting && (
            <div className="absolute inset-0 z-50 flex items-center justify-center rounded-lg bg-white/80">
              <div className="flex flex-col items-center gap-3">
                <Loader2Icon className="h-8 w-8 animate-spin text-slate-500" />
                <p className="text-sm font-medium text-slate-700">
                  {t("workspace.unify.importing_historical_data")}
                </p>
              </div>
            </div>
          )}

          <DialogHeader>
            <DialogTitle>{getDialogTitle(currentStep, selectedType, t)}</DialogTitle>
            <DialogDescription>{getDialogDescription(currentStep, selectedType, t)}</DialogDescription>
          </DialogHeader>

          <div className="py-4">
            {currentStep === "selectType" && (
              <ConnectorTypeSelector
                selectedType={selectedType}
                onSelectType={setSelectedType}
                surveyCount={surveys.length}
                workspaceId={workspaceId}
              />
            )}

            {currentStep === "mapping" && selectedType === "formbricks_survey" && (
              <FormProvider {...formbricksForm}>
                <form className="space-y-4">
                  <FormField
                    control={formbricksForm.control}
                    name="sourceName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t("workspace.unify.source_name")}</FormLabel>
                        <FormControl>
                          <Input
                            value={field.value}
                            onChange={field.onChange}
                            placeholder={t("workspace.unify.enter_name_for_source")}
                          />
                        </FormControl>
                        <FormError />
                      </FormItem>
                    )}
                  />

                  {directories.length === 0 && <NoFeedbackDirectoryAlert workspaceId={workspaceId} t={t} />}

                  <FormField
                    control={formbricksForm.control}
                    name="surveyId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t("workspace.unify.select_survey")}</FormLabel>
                        <FormControl>
                          <Select value={field.value} onValueChange={field.onChange}>
                            <SelectTrigger>
                              <SelectValue placeholder={t("workspace.unify.select_survey")} />
                            </SelectTrigger>
                            <SelectContent>
                              {surveys.map((survey) => (
                                <SelectItem key={survey.id} value={survey.id}>
                                  {survey.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </FormControl>
                        <FormError />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={formbricksForm.control}
                    name="selectedQuestionIds"
                    render={() => (
                      <FormItem>
                        <FormLabel>{t("workspace.unify.select_questions")}</FormLabel>
                        <FormControl>
                          <div>
                            <FormbricksQuestionList
                              survey={selectedSurvey}
                              selectedQuestionIds={selectedQuestionIds}
                              onQuestionToggle={handleFormbricksQuestionToggle}
                            />
                          </div>
                        </FormControl>
                        <FormError />
                      </FormItem>
                    )}
                  />

                  {selectedSurveyResponseCount !== null && selectedSurveyResponseCount > 0 && (
                    <FormField
                      control={formbricksForm.control}
                      name="importHistorical"
                      render={({ field }) => (
                        <FormItem className="rounded-md border border-slate-200 p-3">
                          <div className="flex items-start justify-between gap-3">
                            <div className="space-y-1">
                              <FormLabel>{t("workspace.unify.import_historical_responses")}</FormLabel>
                              <p className="text-sm text-slate-500">
                                {t("workspace.unify.import_historical_responses_description")}
                              </p>
                            </div>
                            <Switch checked={field.value} onCheckedChange={field.onChange} />
                          </div>
                        </FormItem>
                      )}
                    />
                  )}
                </form>
              </FormProvider>
            )}

            {currentStep === "mapping" && selectedType === "csv" && (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="connectorName">{t("workspace.unify.source_name")}</Label>
                  <Input
                    id="connectorName"
                    value={csvConnectorName}
                    onChange={(event) => setCsvConnectorName(event.target.value)}
                    placeholder={t("workspace.unify.enter_name_for_source")}
                  />
                </div>

                {directories.length === 0 && <NoFeedbackDirectoryAlert workspaceId={workspaceId} t={t} />}

                <div className="max-h-[55vh] overflow-y-auto rounded-lg border border-slate-200 p-4">
                  <CsvConnectorUI
                    sourceFields={sourceFields}
                    mappings={mappings}
                    onMappingsChange={(m) => {
                      setMappings(m);
                      setEnumValidationErrors([]);
                    }}
                    onSourceFieldsChange={setSourceFields}
                    onLoadSampleCSV={handleLoadSourceFields}
                    onParsedDataChange={setCsvParsedData}
                  />
                </div>

                {enumValidationErrors.length > 0 && (
                  <Alert variant="error" size="small">
                    {enumValidationErrors.map((err) => {
                      const uniqueValues = [...new Set(err.invalidEntries.map((e) => e.value))];
                      const rowNumbers = err.invalidEntries.slice(0, 5).map((e) => e.row);
                      return (
                        <div key={err.targetFieldName} className="text-xs">
                          <p className="font-medium">
                            {t("workspace.unify.invalid_enum_values", {
                              field: err.targetFieldName,
                            })}
                          </p>
                          <p>
                            {t("workspace.unify.invalid_values_found", {
                              values: uniqueValues.join(", "),
                              rows: rowNumbers.join(", "),
                              extra: err.invalidEntries.length > 5 ? `+${err.invalidEntries.length - 5}` : "",
                            })}
                          </p>
                          <p className="mt-1 text-slate-500">
                            {t("workspace.unify.allowed_values", {
                              values: err.allowedValues.join(", "),
                            })}
                          </p>
                        </div>
                      );
                    })}
                  </Alert>
                )}
              </div>
            )}
          </div>

          <DialogFooter>
            {currentStep === "mapping" && (
              <Button variant="outline" onClick={handleBack} disabled={isCreating || isImporting}>
                {t("common.back")}
              </Button>
            )}
            {currentStep === "selectType" ? (
              <Button
                onClick={handleNextStep}
                disabled={!selectedType || (selectedType === "formbricks_survey" && surveys.length === 0)}>
                {getNextStepButtonLabel(selectedType, t)}
              </Button>
            ) : (
              <Button
                onClick={
                  selectedType === "formbricks_survey"
                    ? () => void formbricksForm.handleSubmit(handleCreateFormbricksConnector)()
                    : handleCreateCsvConnector
                }
                disabled={
                  isCreating ||
                  isImporting ||
                  !selectedDirectoryId ||
                  (selectedType === "formbricks_survey"
                    ? !isConnectorNameValid(formbricksValues.sourceName ?? "") ||
                      !formbricksValues.surveyId ||
                      !formbricksValues.selectedQuestionIds?.length
                    : !isConnectorNameValid(csvConnectorName) || !isCsvValid || !areCsvRequiredFieldsMapped)
                }>
                {isCreating && <Loader2Icon className="mr-2 h-4 w-4 animate-spin" />}
                {t("workspace.unify.setup_connection")}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

interface NoFeedbackDirectoryAlertProps {
  workspaceId: string;
  t: (key: string) => string;
}

const NoFeedbackDirectoryAlert = ({ workspaceId, t }: NoFeedbackDirectoryAlertProps) => {
  return (
    <Alert variant="error" size="small">
      <div>
        <p>{t("workspace.unify.no_feedback_directory_available")}</p>
        <a
          className="mt-1 inline-block font-medium underline"
          href={`/workspaces/${workspaceId}/settings/organization/feedback-directories`}>
          {t("workspace.unify.go_to_feedback_directories")}
        </a>
      </div>
    </Alert>
  );
};
