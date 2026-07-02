"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2Icon, PlusIcon } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import toast from "react-hot-toast";
import { Trans, useTranslation } from "react-i18next";
import {
  TFeedbackSourceType,
  UNSUPPORTED_FEEDBACK_SOURCE_ELEMENT_TYPES,
} from "@formbricks/types/feedback-source";
import { getResponseCountAction, importHistoricalResponsesAction } from "@/lib/feedback-source/actions";
import { getFormattedErrorMessage } from "@/lib/utils/helper";
import { organizationSettingsPath } from "@/modules/settings/lib/routes";
import { Alert, AlertDescription } from "@/modules/ui/components/alert";
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
import { getSurveysForUnifyAction } from "../actions";
import { importCsvFile } from "../csv-import-client";
import {
  CSV_HIDDEN_STATIC_MAPPINGS,
  CSV_PROTECTED_TARGET_IDS,
  TCreateFeedbackSourceStep,
  TFieldMapping,
  TFormbricksFeedbackSourceForm,
  TSourceField,
  TUnifySurvey,
  ZFormbricksFeedbackSourceForm,
  getTranslatedFeedbackSourceError,
} from "../types";
import {
  TEnumValidationError,
  TFeedbackSourceOptionId,
  areAllRequiredCsvFieldsMapped,
  isFeedbackSourceNameValid,
  toggleQuestionId,
  validateEnumMappings,
} from "../utils";
import { CsvFeedbackSourceUI } from "./csv-feedback-source-ui";
import { FeedbackSourceTypeSelector } from "./feedback-source-type-selector";
import { FormbricksQuestionList } from "./formbricks-question-list";

const API_INGESTION_DOCS_URL = "https://formbricks.com/docs/unify-feedback/api/rest-api";
const FEEDBACK_RECORD_MCP_DOCS_URL = "https://formbricks.com/docs/unify-feedback/api/mcp";

interface CreateFeedbackSourceDataset {
  id: string;
  name: string;
  workspaceIds: string[];
}

interface CreateFeedbackSourceModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  showTrigger?: boolean;
  onCreateFeedbackSource: (data: {
    name: string;
    type: TFeedbackSourceType;
    workspaceId: string;
    feedbackDirectoryId: string;
    surveyMappings?: { surveyId: string; elementIds: string[] }[];
    fieldMappings?: TFieldMapping[];
  }) => Promise<string | undefined>;
  organizationId: string;
  // Datasets the user can create a source in, each carrying the workspaces (already narrowed to the
  // user's writable ones) it is assigned to.
  datasets: CreateFeedbackSourceDataset[];
  // Names for every workspace the user can reach, used to label the workspace picker.
  workspaces: { id: string; name: string }[];
}

const getDialogTitle = (
  step: TCreateFeedbackSourceStep,
  type: TFeedbackSourceOptionId | null,
  t: (key: string) => string
): string => {
  if (step === "selectType") return t("workspace.unify.add_feedback_source");
  if (type === "formbricks_survey") return t("workspace.unify.select_survey_and_questions");
  if (type === "csv") return t("workspace.unify.import_csv_data");
  return t("workspace.unify.configure_mapping");
};

const getDialogDescription = (
  step: TCreateFeedbackSourceStep,
  type: TFeedbackSourceOptionId | null,
  t: (key: string) => string
): string => {
  if (step === "selectType") return t("workspace.unify.select_source_type_description");
  if (type === "formbricks_survey") return t("workspace.unify.select_survey_questions_description");
  if (type === "csv") return t("workspace.unify.upload_csv_data_description");
  return t("workspace.unify.configure_mapping");
};

const getNextStepButtonLabel = (type: TFeedbackSourceOptionId | null, t: (key: string) => string): string => {
  if (type === "formbricks_survey") return t("workspace.unify.select_questions");
  if (type === "csv") return t("workspace.unify.configure_import");
  if (type === "api_ingestion") return t("common.learn_more");
  if (type === "feedback_record_mcp") return t("common.learn_more");
  return t("workspace.unify.create_mapping");
};

const getSelectableQuestionIds = (survey: TUnifySurvey): string[] =>
  survey.elements
    .filter(
      (element) => !(UNSUPPORTED_FEEDBACK_SOURCE_ELEMENT_TYPES as readonly string[]).includes(element.type)
    )
    .map((element) => element.id);

type TImportState = "success" | "error" | "skipped";

export const CreateFeedbackSourceModal = ({
  open,
  onOpenChange,
  showTrigger = true,
  onCreateFeedbackSource,
  organizationId,
  datasets,
  workspaces,
}: CreateFeedbackSourceModalProps) => {
  const { t } = useTranslation();

  const workspaceNameById = useMemo(
    () => new Map(workspaces.map((workspace) => [workspace.id, workspace.name])),
    [workspaces]
  );

  // Only datasets with at least one workspace the user can create in are selectable.
  const selectableDatasets = useMemo(
    () => datasets.filter((dataset) => dataset.workspaceIds.length > 0),
    [datasets]
  );

  const defaultFeedbackSourceName = useMemo<Record<TFeedbackSourceType, string>>(
    () => ({
      formbricks_survey: t("workspace.unify.default_source_name_formbricks"),
      csv: t("workspace.unify.default_source_name_csv"),
    }),
    [t]
  );

  const formbricksForm = useForm<TFormbricksFeedbackSourceForm>({
    resolver: zodResolver(ZFormbricksFeedbackSourceForm),
    defaultValues: {
      sourceName: defaultFeedbackSourceName.formbricks_survey,
      surveyId: "",
      selectedQuestionIds: [],
      importHistorical: true,
    },
    mode: "onChange",
  });

  const [currentStep, setCurrentStep] = useState<TCreateFeedbackSourceStep>("selectType");
  const [selectedType, setSelectedType] = useState<TFeedbackSourceOptionId | null>(null);
  const [mappings, setMappings] = useState<TFieldMapping[]>([]);
  const [sourceFields, setSourceFields] = useState<TSourceField[]>([]);
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [csvParsedData, setCsvParsedData] = useState<Record<string, string>[]>([]);
  const [enumValidationErrors, setEnumValidationErrors] = useState<TEnumValidationError[]>([]);
  const [csvFeedbackSourceName, setCsvFeedbackSourceName] = useState("");
  const [responseCountBySurvey, setResponseCountBySurvey] = useState<Record<string, number | null>>({});
  const [isImporting, setIsImporting] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [selectedDatasetId, setSelectedDatasetId] = useState<string>(selectableDatasets[0]?.id ?? "");
  const [selectedWorkspaceId, setSelectedWorkspaceId] = useState<string>("");
  const [surveys, setSurveys] = useState<TUnifySurvey[]>([]);
  const [isLoadingSurveys, setIsLoadingSurveys] = useState(false);
  const userEditedFeedbackSourceNameRef = useRef(false);

  const selectedDataset = useMemo(
    () => selectableDatasets.find((dataset) => dataset.id === selectedDatasetId) ?? null,
    [selectableDatasets, selectedDatasetId]
  );

  // The workspaces offered for the chosen dataset (assigned ∩ writable, resolved on the server).
  const eligibleWorkspaces = useMemo(
    () =>
      (selectedDataset?.workspaceIds ?? []).map((workspaceId) => ({
        id: workspaceId,
        name: workspaceNameById.get(workspaceId) ?? workspaceId,
      })),
    [selectedDataset, workspaceNameById]
  );

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

  const showFeedbackRecordsSuccessToast = useCallback(
    (message: string) => {
      const feedbackRecordsHref = organizationSettingsPath(organizationId, "unify-feedback/datasets");
      toast.success(() => (
        <div className="flex flex-col gap-1">
          <span>{message}</span>
          <Link className="text-sm font-medium underline" href={feedbackRecordsHref}>
            {t("workspace.unify.feedback_records")}
          </Link>
        </div>
      ));
    },
    [organizationId, t]
  );

  // Loads the chosen workspace's surveys for the Formbricks flow (replaces the old page-level SSR load).
  const loadSurveys = useCallback(
    async (directoryId: string, workspaceId: string) => {
      setIsLoadingSurveys(true);
      try {
        const result = await getSurveysForUnifyAction({ organizationId, directoryId, workspaceId });
        if (result?.data) {
          setSurveys(result.data);
        } else {
          setSurveys([]);
          const message = getFormattedErrorMessage(result);
          if (message) toast.error(message);
        }
      } catch {
        setSurveys([]);
        toast.error(t("common.something_went_wrong"));
      } finally {
        setIsLoadingSurveys(false);
      }
    },
    [organizationId, t]
  );

  const fetchResponseCount = useCallback(
    async (surveyId: string) => {
      if (!selectedWorkspaceId || responseCountBySurvey[surveyId] !== undefined) return;
      try {
        const result = await getResponseCountAction({ surveyId, workspaceId: selectedWorkspaceId });
        if (result?.data !== undefined) {
          setResponseCountBySurvey((prev) => ({ ...prev, [surveyId]: result.data ?? null }));
        }
      } catch {
        setResponseCountBySurvey((prev) => ({ ...prev, [surveyId]: null }));
      }
    },
    [responseCountBySurvey, selectedWorkspaceId]
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
      sourceName: defaultFeedbackSourceName.formbricks_survey,
      surveyId: "",
      selectedQuestionIds: [],
      importHistorical: true,
    });
    setMappings([]);
    setSourceFields([]);
    setCsvFile(null);
    setCsvParsedData([]);
    setEnumValidationErrors([]);
    setResponseCountBySurvey({});
    setCsvFeedbackSourceName("");
    userEditedFeedbackSourceNameRef.current = false;
    setIsImporting(false);
    setIsCreating(false);
    setSelectedDatasetId(selectableDatasets[0]?.id ?? "");
    setSelectedWorkspaceId("");
    setSurveys([]);
    setIsLoadingSurveys(false);
  };

  const handleOpenChange = (newOpen: boolean) => {
    if (isImporting) return;
    if (!newOpen) resetForm();
    onOpenChange(newOpen);
  };

  const handleDatasetChange = (datasetId: string) => {
    setSelectedDatasetId(datasetId);
    setSelectedWorkspaceId("");
    setSurveys([]);
    setResponseCountBySurvey({});
    formbricksForm.setValue("surveyId", "", { shouldDirty: true, shouldValidate: true });
    formbricksForm.setValue("selectedQuestionIds", [], { shouldDirty: true, shouldValidate: true });
  };

  const handleWorkspaceChange = (workspaceId: string) => {
    setSelectedWorkspaceId(workspaceId);
    setSurveys([]);
    setResponseCountBySurvey({});
    formbricksForm.setValue("surveyId", "", { shouldDirty: true, shouldValidate: true });
    formbricksForm.setValue("selectedQuestionIds", [], { shouldDirty: true, shouldValidate: true });
    if (selectedType === "formbricks_survey" && selectedDatasetId) {
      void loadSurveys(selectedDatasetId, workspaceId);
    }
  };

  const handleNextStep = () => {
    if (currentStep !== "selectType" || !selectedType) return;

    if (selectedType === "api_ingestion") {
      window.open(API_INGESTION_DOCS_URL, "_blank", "noopener,noreferrer");
      return;
    }

    if (selectedType === "feedback_record_mcp") {
      window.open(FEEDBACK_RECORD_MCP_DOCS_URL, "_blank", "noopener,noreferrer");
      return;
    }

    if (selectedType === "formbricks_survey") {
      formbricksForm.reset({
        sourceName: defaultFeedbackSourceName.formbricks_survey,
        surveyId: "",
        selectedQuestionIds: [],
        importHistorical: true,
      });
    }

    if (selectedType === "csv") {
      setCsvFeedbackSourceName(defaultFeedbackSourceName.csv);
    }

    setCurrentStep("mapping");
  };

  const handleBack = () => {
    if (currentStep === "mapping") {
      setCurrentStep("selectType");
      setMappings([]);
      setSourceFields([]);
      setCsvFile(null);
      setCsvParsedData([]);
      setEnumValidationErrors([]);
      setSurveys([]);
      setSelectedWorkspaceId("");
    }
  };

  const handleHistoricalImport = async (
    feedbackSourceId: string,
    surveyId: string
  ): Promise<TImportState> => {
    const responseCount = responseCountBySurvey[surveyId] ?? 0;
    if (responseCount <= 0 || !selectedWorkspaceId) return "skipped";
    setIsImporting(true);
    try {
      const importResult = await importHistoricalResponsesAction({
        feedbackSourceId,
        workspaceId: selectedWorkspaceId,
        surveyId,
      });

      if (importResult?.data) {
        showFeedbackRecordsSuccessToast(
          t("workspace.unify.historical_import_complete", {
            successes: importResult.data.successes,
            failures: importResult.data.failures,
            skipped: importResult.data.skipped,
          })
        );
        return "success";
      }

      toast.error(getFormattedErrorMessage(importResult));
      return "error";
    } catch {
      toast.error(t("common.something_went_wrong"));
      return "error";
    } finally {
      setIsImporting(false);
    }
  };

  const handleCsvImport = async (feedbackSourceId: string): Promise<TImportState> => {
    if (!csvFile || !selectedWorkspaceId) return "skipped";

    setIsImporting(true);
    try {
      const importResult = await importCsvFile({
        feedbackSourceId,
        workspaceId: selectedWorkspaceId,
        file: csvFile,
      });

      if (importResult?.data) {
        showFeedbackRecordsSuccessToast(
          t("workspace.unify.csv_import_complete", {
            successes: importResult.data.successes,
            failures: importResult.data.failures,
            skipped: importResult.data.skipped,
          })
        );
        return "success";
      }

      toast.error(
        getTranslatedFeedbackSourceError(importResult.error.error, t, {
          row: importResult.error.row,
          max: importResult.error.max,
        })
      );
      return "error";
    } catch {
      toast.error(t("common.something_went_wrong"));
      return "error";
    } finally {
      setIsImporting(false);
    }
  };

  const handleFormbricksQuestionToggle = (questionId: string) => {
    const nextSelection = toggleQuestionId(formbricksForm.getValues("selectedQuestionIds"), questionId);
    formbricksForm.setValue("selectedQuestionIds", nextSelection, {
      shouldDirty: true,
      shouldValidate: true,
    });
  };

  const handleCreateFormbricksFeedbackSource = async (values: TFormbricksFeedbackSourceForm) => {
    if (!selectedDatasetId || !selectedWorkspaceId) return;
    setIsCreating(true);

    const feedbackSourceId = await onCreateFeedbackSource({
      name: values.sourceName.trim(),
      type: "formbricks_survey",
      workspaceId: selectedWorkspaceId,
      feedbackDirectoryId: selectedDatasetId,
      surveyMappings: [{ surveyId: values.surveyId, elementIds: values.selectedQuestionIds }],
    });

    if (!feedbackSourceId) {
      setIsCreating(false);
      return;
    }

    const importState = values.importHistorical
      ? await handleHistoricalImport(feedbackSourceId, values.surveyId)
      : "skipped";
    if (importState === "skipped") {
      showFeedbackRecordsSuccessToast(t("workspace.unify.source_created_successfully"));
    }

    setIsCreating(false);
    resetForm();
    onOpenChange(false);
  };

  const handleCreateCsvFeedbackSource = async () => {
    if (!selectedDatasetId || !selectedWorkspaceId || !isFeedbackSourceNameValid(csvFeedbackSourceName)) {
      return;
    }

    const requiredCheck = areAllRequiredCsvFieldsMapped(mappings);
    if (!requiredCheck.valid) {
      toast.error(
        t("workspace.unify.csv_required_fields_missing", { fields: requiredCheck.missing.join(", ") })
      );
      return;
    }

    if (csvParsedData.length > 0) {
      const errors = validateEnumMappings(mappings, csvParsedData);
      if (errors.length > 0) {
        setEnumValidationErrors(errors);
        return;
      }
      setEnumValidationErrors([]);
    }

    setIsCreating(true);

    // Strip any user-supplied tenant_id and merge hidden static mappings (source_type=csv).
    const userMappings = mappings.filter((m) =>
      CSV_PROTECTED_TARGET_IDS.every((id) => m.targetFieldId !== id)
    );
    const fieldMappings = [...userMappings, ...CSV_HIDDEN_STATIC_MAPPINGS];

    const feedbackSourceId = await onCreateFeedbackSource({
      name: csvFeedbackSourceName.trim(),
      type: "csv",
      workspaceId: selectedWorkspaceId,
      feedbackDirectoryId: selectedDatasetId,
      fieldMappings,
    });

    if (!feedbackSourceId) {
      setIsCreating(false);
      return;
    }

    const importState = csvParsedData.length > 0 ? await handleCsvImport(feedbackSourceId) : "skipped";
    if (importState === "skipped") {
      showFeedbackRecordsSuccessToast(t("workspace.unify.source_created_successfully"));
    }

    setIsCreating(false);
    resetForm();
    onOpenChange(false);
  };

  const isCsvValid = selectedType === "csv" && sourceFields.length > 0;
  const areCsvRequiredFieldsMapped = areAllRequiredCsvFieldsMapped(mappings).valid;

  const handleSuggestFeedbackSourceName = (name: string) => {
    if (userEditedFeedbackSourceNameRef.current) return;
    setCsvFeedbackSourceName(name);
  };

  const handleCsvFeedbackSourceNameChange = (value: string) => {
    userEditedFeedbackSourceNameRef.current = true;
    setCsvFeedbackSourceName(value);
  };

  const showNoSurveysAlert =
    selectedType === "formbricks_survey" &&
    !!selectedWorkspaceId &&
    !isLoadingSurveys &&
    surveys.length === 0;

  return (
    <>
      {showTrigger && (
        <Button onClick={() => onOpenChange(true)} size="sm">
          {t("workspace.unify.add_source")}
          <PlusIcon className="ml-2 size-4" />
        </Button>
      )}

      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent className="max-w-3xl">
          {isImporting && (
            <div className="absolute inset-0 z-50 flex items-center justify-center rounded-lg bg-white/80">
              <div className="flex flex-col items-center gap-3">
                <Loader2Icon className="size-8 animate-spin text-slate-500" />
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

          <DialogBody>
            {currentStep === "selectType" && (
              <FeedbackSourceTypeSelector selectedType={selectedType} onSelectType={setSelectedType} />
            )}
            {currentStep === "mapping" && selectedType === "formbricks_survey" && (
              <FormProvider {...formbricksForm}>
                <form
                  className="space-y-4"
                  onSubmit={formbricksForm.handleSubmit(handleCreateFormbricksFeedbackSource)}>
                  <FormField
                    control={formbricksForm.control}
                    name="sourceName"
                    render={({ field, fieldState: { error } }) => (
                      <FormItem>
                        <FormLabel>{t("workspace.unify.source_name")}</FormLabel>
                        <FormControl>
                          <Input
                            value={field.value}
                            onChange={field.onChange}
                            placeholder={t("workspace.unify.enter_name_for_source")}
                          />
                        </FormControl>
                        {error?.message && (
                          <FormError>{getTranslatedFeedbackSourceError(error.message, t)}</FormError>
                        )}
                      </FormItem>
                    )}
                  />

                  <DatasetWorkspacePickers
                    datasets={selectableDatasets}
                    selectedDatasetId={selectedDatasetId}
                    onDatasetChange={handleDatasetChange}
                    eligibleWorkspaces={eligibleWorkspaces}
                    selectedWorkspaceId={selectedWorkspaceId}
                    onWorkspaceChange={handleWorkspaceChange}
                  />

                  {showNoSurveysAlert && <NoFormbricksSurveysAlert workspaceId={selectedWorkspaceId} />}

                  <FormField
                    control={formbricksForm.control}
                    name="surveyId"
                    render={({ field, fieldState: { error } }) => (
                      <FormItem>
                        <FormLabel>{t("workspace.unify.select_survey")}</FormLabel>
                        <FormControl>
                          <Select
                            value={field.value}
                            onValueChange={field.onChange}
                            disabled={!selectedWorkspaceId || isLoadingSurveys || surveys.length === 0}>
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
                        {error?.message && (
                          <FormError>{getTranslatedFeedbackSourceError(error.message, t)}</FormError>
                        )}
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={formbricksForm.control}
                    name="selectedQuestionIds"
                    render={({ fieldState: { error } }) => (
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
                        {error?.message && (
                          <FormError>{getTranslatedFeedbackSourceError(error.message, t)}</FormError>
                        )}
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
                  <Label htmlFor="feedbackSourceName">{t("workspace.unify.source_name")}</Label>
                  <Input
                    id="feedbackSourceName"
                    value={csvFeedbackSourceName}
                    onChange={(event) => handleCsvFeedbackSourceNameChange(event.target.value)}
                    placeholder={t("workspace.unify.enter_name_for_source")}
                  />
                  <p className="text-xs text-slate-500">{t("workspace.unify.source_name_hint")}</p>
                </div>

                <DatasetWorkspacePickers
                  datasets={selectableDatasets}
                  selectedDatasetId={selectedDatasetId}
                  onDatasetChange={handleDatasetChange}
                  eligibleWorkspaces={eligibleWorkspaces}
                  selectedWorkspaceId={selectedWorkspaceId}
                  onWorkspaceChange={handleWorkspaceChange}
                />

                <div className="max-h-[55vh] overflow-y-auto rounded-lg border border-slate-200 p-4">
                  <CsvFeedbackSourceUI
                    sourceFields={sourceFields}
                    mappings={mappings}
                    onMappingsChange={(m) => {
                      setMappings(m);
                      setEnumValidationErrors([]);
                    }}
                    onSourceFieldsChange={setSourceFields}
                    onFileChange={setCsvFile}
                    onParsedDataChange={setCsvParsedData}
                    onSuggestFeedbackSourceName={handleSuggestFeedbackSourceName}
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
          </DialogBody>

          <DialogFooter>
            {currentStep === "mapping" && (
              <Button variant="outline" onClick={handleBack} disabled={isCreating || isImporting}>
                {t("common.back")}
              </Button>
            )}
            {currentStep === "selectType" ? (
              <Button onClick={handleNextStep} disabled={!selectedType}>
                {getNextStepButtonLabel(selectedType, t)}
              </Button>
            ) : (
              <Button
                onClick={
                  selectedType === "formbricks_survey"
                    ? () => void formbricksForm.handleSubmit(handleCreateFormbricksFeedbackSource)()
                    : handleCreateCsvFeedbackSource
                }
                disabled={
                  isCreating ||
                  isImporting ||
                  !selectedDatasetId ||
                  !selectedWorkspaceId ||
                  (selectedType === "formbricks_survey"
                    ? !isFeedbackSourceNameValid(formbricksValues.sourceName ?? "") ||
                      !formbricksValues.surveyId ||
                      !formbricksValues.selectedQuestionIds?.length
                    : !isFeedbackSourceNameValid(csvFeedbackSourceName) ||
                      !isCsvValid ||
                      !areCsvRequiredFieldsMapped)
                }>
                {isCreating && <Loader2Icon className="mr-2 size-4 animate-spin" />}
                {t("workspace.unify.setup_connection")}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

interface DatasetWorkspacePickersProps {
  datasets: CreateFeedbackSourceDataset[];
  selectedDatasetId: string;
  onDatasetChange: (datasetId: string) => void;
  eligibleWorkspaces: { id: string; name: string }[];
  selectedWorkspaceId: string;
  onWorkspaceChange: (workspaceId: string) => void;
}

const DatasetWorkspacePickers = ({
  datasets,
  selectedDatasetId,
  onDatasetChange,
  eligibleWorkspaces,
  selectedWorkspaceId,
  onWorkspaceChange,
}: DatasetWorkspacePickersProps) => {
  const { t } = useTranslation();

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      <div className="space-y-2">
        <Label>{t("workspace.settings.feedback_directories.directory_name")}</Label>
        <Select value={selectedDatasetId} onValueChange={onDatasetChange}>
          <SelectTrigger>
            <SelectValue placeholder={t("common.select")} />
          </SelectTrigger>
          <SelectContent>
            {datasets.map((dataset) => (
              <SelectItem key={dataset.id} value={dataset.id}>
                {dataset.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-2">
        <Label>{t("common.workspace")}</Label>
        <Select
          value={selectedWorkspaceId}
          onValueChange={onWorkspaceChange}
          disabled={!selectedDatasetId || eligibleWorkspaces.length === 0}>
          <SelectTrigger>
            <SelectValue placeholder={t("common.select")} />
          </SelectTrigger>
          <SelectContent>
            {eligibleWorkspaces.map((workspace) => (
              <SelectItem key={workspace.id} value={workspace.id}>
                {workspace.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
};

const NoFormbricksSurveysAlert = ({ workspaceId }: Readonly<{ workspaceId: string }>) => {
  return (
    <Alert variant="info" size="small">
      <AlertDescription className="overflow-visible whitespace-normal">
        <Trans
          i18nKey="workspace.unify.no_formbricks_surveys_available_description"
          components={{
            surveyLink: (
              <Link href={`/workspaces/${workspaceId}/surveys/templates`} className="font-medium underline" />
            ),
          }}
        />
      </AlertDescription>
    </Alert>
  );
};
