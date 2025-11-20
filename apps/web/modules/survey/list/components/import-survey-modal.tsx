"use client";

import { ArrowUpFromLineIcon, CheckIcon } from "lucide-react";
import React, { useState } from "react";
import toast from "react-hot-toast";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/cn";
import { importSurveyAction, validateSurveyImportAction } from "@/modules/survey/list/actions";
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

  const resetState = () => {
    setFileName("");
    setSurveyData(null);
    setValidationErrors([]);
    setValidationWarnings([]);
    setValidationInfos([]);
    setNewName("");
    setIsLoading(false);
    setIsValid(false);
  };

  const onOpenChange = (open: boolean) => {
    if (!open) {
      resetState();
    }
    setOpen(open);
  };

  const processJSONFile = async (file: File) => {
    if (!file) return;

    if (file.type !== "application/json" && !file.name.endsWith(".json")) {
      toast.error(t("environments.surveys.import_error_invalid_json"));
      setValidationErrors([t("environments.surveys.import_error_invalid_json")]);
      setFileName("");
      setIsValid(false);
      return;
    }

    setFileName(file.name);
    setIsLoading(true);
    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const json = JSON.parse(event.target?.result as string);
        setSurveyData(json);

        const result = await validateSurveyImportAction({
          surveyData: json,
          environmentId,
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
      } catch (error) {
        toast.error(t("environments.surveys.import_error_invalid_json"));
        setValidationErrors([t("environments.surveys.import_error_invalid_json")]);
        setValidationWarnings([]);
        setValidationInfos([]);
        setIsValid(false);
      } finally {
        setIsLoading(false);
      }
    };
    reader.readAsText(file);
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      processJSONFile(file);
    }
  };

  const handleDragOver = (e: React.DragEvent<HTMLLabelElement>) => {
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = "copy";
  };

  const handleDrop = (e: React.DragEvent<HTMLLabelElement>) => {
    e.preventDefault();
    e.stopPropagation();

    const file = e.dataTransfer.files[0];
    if (file) {
      processJSONFile(file);
    }
  };

  const handleImport = async () => {
    if (!surveyData) {
      toast.error(t("environments.surveys.import_survey_error"));
      return;
    }
    setIsLoading(true);
    try {
      const result = await importSurveyAction({
        surveyData,
        environmentId,
        newName,
      });

      if (result?.data) {
        toast.success(t("environments.surveys.import_survey_success"));
        onOpenChange(false);
        window.location.href = `/environments/${environmentId}/surveys/${result.data.surveyId}/edit`;
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
      setIsLoading(false);
    }
  };

  const renderUploadSection = () => {
    if (isLoading) {
      return (
        <div className="flex items-center justify-center py-8">
          <LoadingSpinner />
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
            <p className="text-xs text-slate-400">.json files only</p>
            <Input
              id="import-file"
              type="file"
              accept=".json"
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
          accept=".json"
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
                <AlertDescription>
                  <ul className="list-disc pl-4 text-sm">
                    {validationErrors.map((error, i) => (
                      <li key={i}>{error}</li>
                    ))}
                  </ul>
                </AlertDescription>
              </Alert>
            )}

            {validationWarnings.length > 0 && (
              <Alert variant="warning">
                <AlertTitle>{t("environments.surveys.import_survey_warnings")}</AlertTitle>
                <AlertDescription>
                  <ul className="list-disc pl-4 text-sm">
                    {validationWarnings.map((warningKey, i) => (
                      <li key={i}>{t(`environments.surveys.${warningKey}`)}</li>
                    ))}
                  </ul>
                </AlertDescription>
              </Alert>
            )}

            {validationInfos.length > 0 && (
              <Alert variant="info">
                <AlertDescription>
                  <ul className="list-disc pl-4 text-sm">
                    {validationInfos.map((infoKey, i) => (
                      <li key={i}>{t(`environments.surveys.${infoKey}`)}</li>
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
