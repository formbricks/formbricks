"use client";

import { ArrowUpFromLineIcon, CheckIcon } from "lucide-react";
import React, { useEffect, useState } from "react";
import toast from "react-hot-toast";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/cn";
import {
  convertSurveyDocxToPayloadAction,
  importSurveyWithDestinationAction,
  validateSurveyImportAction,
} from "@/modules/survey/list/actions";
import { type TSurveyExportPayload } from "@/modules/survey/list/lib/export-survey";
import { Alert, AlertDescription, AlertTitle } from "@/modules/ui/components/alert";
import { Button } from "@/modules/ui/components/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/modules/ui/components/dialog";
import { Input } from "@/modules/ui/components/input";
import { Label } from "@/modules/ui/components/label";
import { LoadingSpinner } from "@/modules/ui/components/loading-spinner";

interface ImportSurveyModalProps {
  environmentId: string;
  open: boolean;
  setOpen: (open: boolean) => void;
}

type TImportLoadingPhase = "idle" | "reading" | "encoding" | "extracting" | "validating" | "importing";

interface TDetectedLanguage {
  code: string;
  confidence: number;
  evidence: string[];
}

export const ImportSurveyModal = ({ environmentId, open, setOpen }: ImportSurveyModalProps) => {
  const { t } = useTranslation();
  const [isLoading, setIsLoading] = useState(false);
  const [fileName, setFileName] = useState<string>("");
  const [surveyData, setSurveyData] = useState<TSurveyExportPayload | null>(null);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [validationWarnings, setValidationWarnings] = useState<string[]>([]);
  const [validationInfos, setValidationInfos] = useState<string[]>([]);
  const [newName, setNewName] = useState("");
  const [isValid, setIsValid] = useState(false);
  const [conversionNotes, setConversionNotes] = useState<string[]>([]);
  const [detectedLanguages, setDetectedLanguages] = useState<TDetectedLanguage[]>([]);
  const [importRunId, setImportRunId] = useState<string | undefined>(undefined);
  const [loadingPhase, setLoadingPhase] = useState<TImportLoadingPhase>("idle");
  const [loadingVerbIndex, setLoadingVerbIndex] = useState(0);

  const loadingVerbs = [
    "beaming",
    "marinating",
    "untangling",
    "juggling",
    "translating",
    "wizarding",
  ] as const;

  useEffect(() => {
    if (!isLoading) {
      setLoadingVerbIndex(0);
      return;
    }

    const intervalId = globalThis.setInterval(() => {
      setLoadingVerbIndex((current) => (current + 1) % loadingVerbs.length);
    }, 1400);

    return () => {
      globalThis.clearInterval(intervalId);
    };
  }, [isLoading, loadingVerbs.length]);

  const resetState = () => {
    setFileName("");
    setSurveyData(null);
    setValidationErrors([]);
    setValidationWarnings([]);
    setValidationInfos([]);
    setNewName("");
    setConversionNotes([]);
    setDetectedLanguages([]);
    setImportRunId(undefined);
    setLoadingPhase("idle");
    setIsLoading(false);
    setIsValid(false);
  };

  const onOpenChange = (open: boolean) => {
    if (!open) {
      resetState();
    }
    setOpen(open);
  };

  const isJsonFile = (file: File): boolean =>
    file.type === "application/json" || file.name.toLowerCase().endsWith(".json");

  const isDocxFile = (file: File): boolean =>
    file.type === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
    file.name.toLowerCase().endsWith(".docx");

  const isLegacyDocFile = (file: File): boolean =>
    file.type === "application/msword" || file.name.toLowerCase().endsWith(".doc");

  const validateConvertedSurvey = async (payload: TSurveyExportPayload, runId?: string) => {
    const result = await validateSurveyImportAction({
      surveyData: payload,
      environmentId,
      importRunId: runId,
    });

    if (result?.data) {
      setValidationErrors(result.data.errors || []);
      setValidationWarnings(result.data.warnings || []);
      setValidationInfos(result.data.infos || []);
      setIsValid(result.data.valid);

      if (result.data.valid) {
        setNewName(result.data.surveyName + " (imported)");
      }
    } else if (result?.serverError) {
      setValidationErrors([result.serverError]);
      setValidationWarnings([]);
      setValidationInfos([]);
      setIsValid(false);
    }
  };

  const processJSONFile = async (file: File) => {
    if (!file) return;

    if (!isJsonFile(file)) {
      toast.error(t("environments.surveys.import_error_invalid_json"));
      setValidationErrors([t("environments.surveys.import_error_invalid_json")]);
      setFileName("");
      setIsValid(false);
      return;
    }

    setFileName(file.name);
    setLoadingPhase("reading");
    setIsLoading(true);
    try {
      const json = JSON.parse(await file.text());
      setSurveyData(json);
      setImportRunId(() => undefined);
      setDetectedLanguages([]);
      setLoadingPhase("validating");
      await validateConvertedSurvey(json, undefined);
    } catch {
      toast.error(t("environments.surveys.import_error_invalid_json"));
      setValidationErrors([t("environments.surveys.import_error_invalid_json")]);
      setValidationWarnings([]);
      setValidationInfos([]);
      setIsValid(false);
    } finally {
      setLoadingPhase("idle");
      setIsLoading(false);
    }
  };

  const toBase64 = async (file: File): Promise<string> => {
    const buffer = await file.arrayBuffer();
    const bytes = new Uint8Array(buffer);
    const chunkSize = 0x8000;
    let binary = "";

    for (let i = 0; i < bytes.length; i += chunkSize) {
      binary += String.fromCodePoint(...bytes.subarray(i, i + chunkSize));
    }

    return btoa(binary);
  };

  const processDocxFile = async (file: File) => {
    if (!file) return;

    if (!isDocxFile(file)) {
      toast.error(t("environments.surveys.import_error_invalid_docx"));
      setValidationErrors([t("environments.surveys.import_error_invalid_docx")]);
      setFileName("");
      setIsValid(false);
      return;
    }

    setFileName(file.name);
    setLoadingPhase("encoding");
    setIsLoading(true);

    try {
      const fileBase64 = await toBase64(file);
      setLoadingPhase("extracting");
      const conversionResult = await convertSurveyDocxToPayloadAction({
        fileBase64,
        fileName: file.name,
        environmentId,
      });

      if (!conversionResult?.data) {
        throw new Error(conversionResult?.serverError || t("environments.surveys.import_error_docx_convert"));
      }

      setSurveyData(conversionResult.data.surveyData);
      setConversionNotes(conversionResult.data.notes || []);
      setDetectedLanguages(conversionResult.data.detectedLanguages || []);
      setImportRunId(conversionResult.data.importRunId);
      setLoadingPhase("validating");
      await validateConvertedSurvey(conversionResult.data.surveyData, conversionResult.data.importRunId);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : t("environments.surveys.import_error_docx_convert");
      toast.error(message);
      setValidationErrors([message]);
      setValidationWarnings([]);
      setValidationInfos([]);
      setIsValid(false);
    } finally {
      setLoadingPhase("idle");
      setIsLoading(false);
    }
  };

  const processSelectedFile = async (file: File) => {
    if (isLegacyDocFile(file) && !isDocxFile(file)) {
      const message = t("environments.surveys.import_error_doc_unsupported");
      toast.error(message);
      setValidationErrors([message]);
      setValidationWarnings([]);
      setValidationInfos([]);
      setFileName("");
      setIsValid(false);
      return;
    }

    if (isJsonFile(file)) {
      await processJSONFile(file);
      return;
    }

    if (isDocxFile(file)) {
      await processDocxFile(file);
      return;
    }

    const message = t("environments.surveys.import_error_invalid_file");
    toast.error(message);
    setValidationErrors([message]);
    setValidationWarnings([]);
    setValidationInfos([]);
    setFileName("");
    setIsValid(false);
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    await processSelectedFile(file);
  };

  const handleDragOver = (e: React.DragEvent<HTMLLabelElement>) => {
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = "copy";
  };

  const handleDrop = async (e: React.DragEvent<HTMLLabelElement>) => {
    e.preventDefault();
    e.stopPropagation();

    const file = e.dataTransfer.files[0];
    if (file) {
      await processSelectedFile(file);
    }
  };

  const handleImport = async () => {
    if (!surveyData) {
      toast.error(t("environments.surveys.import_survey_error"));
      return;
    }
    setLoadingPhase("importing");
    setIsLoading(true);
    try {
      const result = await importSurveyWithDestinationAction({
        surveyData,
        environmentId,
        newName,
        importRunId,
      });

      if (result?.data) {
        toast.success(t("environments.surveys.import_survey_success"));
        onOpenChange(false);
        globalThis.location.href =
          "surveyUrl" in result.data && result.data.surveyUrl
            ? result.data.surveyUrl
            : `/environments/${environmentId}/surveys/${result.data.surveyId}/edit`;
      } else if (result?.serverError) {
        console.error("[Import Survey] Server error:", result.serverError);
        toast.error(result.serverError);
      } else {
        console.error("[Import Survey] Unknown error - no data or serverError returned");
        toast.error(t("environments.surveys.import_survey_error"));
      }
    } catch (error) {
      console.error("[Import Survey] Exception caught:", error);
      const errorMessage =
        error instanceof Error ? error.message : t("environments.surveys.import_survey_error");
      toast.error(errorMessage);
    } finally {
      setLoadingPhase("idle");
      setIsLoading(false);
    }
  };

  const renderUploadSection = () => {
    if (isLoading) {
      const currentVerb = loadingVerbs[loadingVerbIndex];
      return (
        <div className="flex flex-col items-center justify-center gap-2 py-8">
          <LoadingSpinner />
          <p className="text-center text-sm font-medium text-slate-700">
            {t("environments.surveys.import_survey_loading_title", {
              verb: t(`environments.surveys.import_survey_loading_verbs.${currentVerb}`),
            })}
          </p>
          <p className="text-center text-xs text-slate-500">
            {t(`environments.surveys.import_survey_loading_phase.${loadingPhase}`)}
          </p>
        </div>
      );
    }

    if (!fileName) {
      return (
        <label
          htmlFor="import-file"
          className={cn(
            "relative flex cursor-pointer flex-col items-center justify-center rounded-lg hover:bg-slate-100"
          )}
          onDragOver={handleDragOver}
          onDrop={handleDrop}>
          <div className="flex flex-col items-center justify-center pb-6 pt-5">
            <ArrowUpFromLineIcon className="h-6 text-slate-500" />
            <p className="mt-2 text-center text-sm text-slate-500">
              <span className="font-semibold">{t("common.upload_input_description")}</span>
            </p>
            <p className="text-xs text-slate-400">.json, .docx files only</p>
            <Input
              id="import-file"
              type="file"
              accept=".json,.docx,application/json,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
              className="hidden"
              onChange={handleFileChange}
            />
          </div>
        </label>
      );
    }

    return (
      <div className="flex flex-col items-center gap-4 py-4">
        <div className="flex items-center gap-2">
          <CheckIcon className="h-5 w-5 text-green-600" />
          <span className="text-sm font-medium text-slate-700">{fileName}</span>
        </div>
        <Button
          variant="secondary"
          size="sm"
          onClick={() => {
            resetState();
            document.getElementById("import-file-retry")?.click();
          }}>
          {t("environments.contacts.upload_contacts_modal_pick_different_file")}
        </Button>
        <Input
          id="import-file-retry"
          type="file"
          accept=".json,.docx,application/json,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
          className="hidden"
          onChange={handleFileChange}
        />
      </div>
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>{t("environments.surveys.import_survey")}</DialogTitle>
          <DialogDescription>{t("environments.surveys.import_survey_description")}</DialogDescription>
        </DialogHeader>

        <div className="py-4">
          <div className="flex flex-col gap-4">
            <div className="rounded-md border-2 border-dashed border-slate-300 bg-slate-50 p-4">
              {renderUploadSection()}
            </div>

            {validationErrors.length > 0 && (
              <Alert variant="error">
                <AlertTitle>{t("environments.surveys.import_survey_errors")}</AlertTitle>
                <AlertDescription className="max-h-60 overflow-y-auto">
                  <ul className="space-y-2 text-sm">
                    {validationErrors.map((error, i) => {
                      // Check if the error contains a field path (format: 'Field "path":')
                      const fieldMatch = /^Field "([^"]+)": (.+)$/.exec(error);
                      if (fieldMatch) {
                        return (
                          <li key={`${fieldMatch[1]}-${i}`} className="flex flex-col gap-1">
                            <code className="rounded bg-red-50 px-1.5 py-0.5 font-mono text-xs text-red-800">
                              {fieldMatch[1]}
                            </code>
                            <span className="text-slate-700">{fieldMatch[2]}</span>
                          </li>
                        );
                      }
                      return (
                        <li key={`${error}-${i}`} className="text-slate-700">
                          {error}
                        </li>
                      );
                    })}
                  </ul>
                </AlertDescription>
              </Alert>
            )}

            {validationWarnings.length > 0 && (
              <Alert variant="warning">
                <AlertTitle>{t("environments.surveys.import_survey_warnings")}</AlertTitle>
                <AlertDescription className="max-h-60 overflow-y-auto">
                  <ul className="list-disc pl-4 text-sm">
                    {validationWarnings.map((warningKey) => (
                      <li key={warningKey}>{t(`environments.surveys.${warningKey}`)}</li>
                    ))}
                  </ul>
                </AlertDescription>
              </Alert>
            )}

            {validationInfos.length > 0 && (
              <Alert variant="info">
                <AlertDescription className="max-h-60 overflow-y-auto">
                  <ul className="list-disc pl-4 text-sm">
                    {validationInfos.map((infoKey) => (
                      <li key={infoKey}>{t(`environments.surveys.${infoKey}`)}</li>
                    ))}
                  </ul>
                </AlertDescription>
              </Alert>
            )}
            {conversionNotes.length > 0 && (
              <Alert variant="info">
                <AlertTitle>{t("environments.surveys.import_docx_notes_title")}</AlertTitle>
                <AlertDescription className="max-h-60 overflow-y-auto">
                  <ul className="list-disc pl-4 text-sm">
                    {conversionNotes.map((note) => (
                      <li key={note}>{note}</li>
                    ))}
                  </ul>
                </AlertDescription>
              </Alert>
            )}
            {detectedLanguages.length > 0 && (
              <Alert variant="info">
                <AlertTitle>{t("environments.surveys.import_docx_languages_title")}</AlertTitle>
                <AlertDescription className="max-h-60 overflow-y-auto">
                  <ul className="list-disc pl-4 text-sm">
                    {detectedLanguages.map((language) => (
                      <li key={language.code}>
                        {t("environments.surveys.import_docx_languages_detected_item", {
                          code: language.code,
                          confidence: Math.round(language.confidence * 100),
                        })}
                      </li>
                    ))}
                  </ul>
                </AlertDescription>
              </Alert>
            )}
            {isValid && fileName && (
              <div className="space-y-2">
                <Label htmlFor="survey-name">{t("environments.surveys.import_survey_name_label")}</Label>
                <Input id="survey-name" value={newName} onChange={(e) => setNewName(e.target.value)} />
              </div>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={isLoading}>
            {t("common.cancel")}
          </Button>
          <Button
            onClick={handleImport}
            loading={isLoading}
            disabled={!isValid || !fileName || validationErrors.length > 0 || isLoading}>
            {t("environments.surveys.import_survey_import")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
