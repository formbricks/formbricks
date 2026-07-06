"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2Icon, PlusIcon } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import toast from "react-hot-toast";
import { useTranslation } from "react-i18next";
import {
  TFeedbackSourceType,
  UNSUPPORTED_FEEDBACK_SOURCE_ELEMENT_TYPES,
} from "@formbricks/types/feedback-source";
import { useWorkspace } from "@/app/(app)/workspaces/[workspaceId]/context/workspace-context";
import { getResponseCountAction, importHistoricalResponsesAction } from "@/lib/feedback-source/actions";
import { getFormattedErrorMessage } from "@/lib/utils/helper";
import { Alert } from "@/modules/ui/components/alert";
import { Badge } from "@/modules/ui/components/badge";
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

interface CreateFeedbackSourceModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  showTrigger?: boolean;
  onCreateFeedbackSource: (data: {
    name: string;
    type: TFeedbackSourceType;
    feedbackDirectoryId: string;
    surveyMappings?: { surveyId: string; elementIds: string[] }[];
    fieldMappings?: TFieldMapping[];
  }) => Promise<string | undefined>;
  surveys: TUnifySurvey[];
  /** Survey ids that already have a feedback source — disabled in the picker (one source per survey). */
  connectedSurveyIds?: string[];
  workspaceId: string;
  directories: { id: string; name: string }[];
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
  surveys,
  connectedSurveyIds = [],
  workspaceId,
  directories,
}: CreateFeedbackSourceModalProps) => {
  const { t } = useTranslation();
  const connectedSurveyIdSet = useMemo(() => new Set(connectedSurveyIds), [connectedSurveyIds]);
  const { workspace } = useWorkspace();

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
  const [selectedDirectoryId, setSelectedDirectoryId] = useState<string | null>(directories[0]?.id ?? null);
  const userEditedFeedbackSourceNameRef = useRef(false);

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
      const feedbackRecordsHref = `/workspaces/${workspaceId}/unify/feedback-records`;
      toast.success(() => (
        <div className="flex flex-col gap-1">
          <span>{message}</span>
          <Link className="text-sm font-medium underline" href={feedbackRecordsHref}>
            {t("workspace.unify.feedback_records")}
          </Link>
        </div>
      ));
    },
    [t, workspaceId]
  );

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
    }
  };

  const handleHistoricalImport = async (
    feedbackSourceId: string,
    surveyId: string
  ): Promise<TImportState> => {
    const responseCount = responseCountBySurvey[surveyId] ?? 0;
    if (responseCount <= 0) return "skipped";
    setIsImporting(true);
    try {
      const importResult = await importHistoricalResponsesAction({
        feedbackSourceId,
        workspaceId,
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
    if (!csvFile) return "skipped";

    setIsImporting(true);
    try {
      const importResult = await importCsvFile({
        feedbackSourceId,
        workspaceId,
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
    if (!selectedDirectoryId) return;
    setIsCreating(true);

    const feedbackSourceId = await onCreateFeedbackSource({
      name: values.sourceName.trim(),
      type: "formbricks_survey",
      feedbackDirectoryId: selectedDirectoryId,
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
    if (!selectedDirectoryId || !isFeedbackSourceNameValid(csvFeedbackSourceName)) return;

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
      feedbackDirectoryId: selectedDirectoryId,
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
              <FeedbackSourceTypeSelector
                selectedType={selectedType}
                onSelectType={setSelectedType}
                surveyCount={surveys.length}
                workspaceId={workspaceId}
              />
            )}
            {currentStep === "mapping" && selectedType === "formbricks_survey" && (
              <FormProvider {...formbricksForm}>
                <form
                  className="space-y-4"
                  onSubmit={formbricksForm.handleSubmit(handleCreateFormbricksFeedbackSource)}>
                  <FormField
                    control={formbricksForm.control}
                    name="surveyId"
                    render={({ field, fieldState: { error } }) => (
                      <FormItem>
                        <FormLabel>{t("workspace.unify.select_survey")}</FormLabel>
                        <FormControl>
                          <Select
                            value={field.value}
                            onValueChange={(value) => {
                              field.onChange(value);
                              // Auto-fill the source name from the survey so users don't have to.
                              // They can still rename it later in the Edit modal.
                              const survey = surveys.find((item) => item.id === value);
                              if (survey) {
                                formbricksForm.setValue(
                                  "sourceName",
                                  t("workspace.unify.source_connector_name", { surveyName: survey.name }),
                                  {
                                    shouldValidate: true,
                                    shouldDirty: true,
                                  }
                                );
                              }
                            }}>
                            <SelectTrigger>
                              <SelectValue placeholder={t("workspace.unify.select_survey")} />
                            </SelectTrigger>
                            <SelectContent>
                              {surveys.map((survey) => {
                                const alreadyConnected = connectedSurveyIdSet.has(survey.id);
                                return (
                                  <SelectItem key={survey.id} value={survey.id} disabled={alreadyConnected}>
                                    <span className="flex items-center gap-2">
                                      {survey.name}
                                      {alreadyConnected && (
                                        <Badge
                                          text={t("workspace.unify.survey_already_connected")}
                                          type="gray"
                                          size="tiny"
                                        />
                                      )}
                                    </span>
                                  </SelectItem>
                                );
                              })}
                            </SelectContent>
                          </Select>
                        </FormControl>
                        {error?.message && (
                          <FormError>{getTranslatedFeedbackSourceError(error.message, t)}</FormError>
                        )}
                      </FormItem>
                    )}
                  />

                  {directories.length === 0 && (
                    <NoFeedbackDirectoryAlert organizationId={workspace?.organizationId} t={t} />
                  )}

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

                {directories.length === 0 && (
                  <NoFeedbackDirectoryAlert organizationId={workspace?.organizationId} t={t} />
                )}

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
              <Button
                onClick={handleNextStep}
                disabled={!selectedType || (selectedType === "formbricks_survey" && surveys.length === 0)}>
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
                  !selectedDirectoryId ||
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

interface NoFeedbackDirectoryAlertProps {
  organizationId?: string;
  t: (key: string) => string;
}

const NoFeedbackDirectoryAlert = ({ organizationId, t }: NoFeedbackDirectoryAlertProps) => {
  return (
    <Alert variant="error" size="small">
      <div>
        <p>{t("workspace.unify.no_feedback_directory_available")}</p>
        {organizationId && (
          <a
            className="mt-1 inline-block font-medium underline"
            href={`/organizations/${organizationId}/settings/feedback-directories`}>
            {t("workspace.unify.go_to_feedback_directories")}
          </a>
        )}
      </div>
    </Alert>
  );
};
