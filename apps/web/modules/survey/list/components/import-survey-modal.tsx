"use client";

import { createId } from "@paralleldrive/cuid2";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import toast from "react-hot-toast";
import { useTranslation } from "react-i18next";
import { logger } from "@formbricks/logger";
import { getFormattedErrorMessage } from "@/lib/utils/helper";
import { importSurveyAction, validateSurveyImportAction } from "@/modules/survey/list/actions";
import { Alert } from "@/modules/ui/components/alert";
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
import { IdBadge } from "@/modules/ui/components/id-badge";
import { Input } from "@/modules/ui/components/input";
import { Label } from "@/modules/ui/components/label";

interface ImportSurveyModalProps {
  environmentId: string;
  open: boolean;
  setOpen: (open: boolean) => void;
  onSurveyImported?: () => void;
}

export const ImportSurveyModal = ({
  environmentId,
  open,
  setOpen,
  onSurveyImported,
}: ImportSurveyModalProps) => {
  const { t } = useTranslation();
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [step, setStep] = useState<"upload" | "preview">("upload");
  const [loading, setLoading] = useState(false);
  const [surveyData, setSurveyData] = useState<any>(null);
  const [surveyName, setSurveyName] = useState("");
  const [newName, setNewName] = useState("");
  const [newSurveyId, setNewSurveyId] = useState("");
  const [errors, setErrors] = useState<string[]>([]);
  const [warnings, setWarnings] = useState<string[]>([]);

  const resetState = () => {
    setStep("upload");
    setSurveyData(null);
    setSurveyName("");
    setNewName("");
    setNewSurveyId("");
    setErrors([]);
    setWarnings([]);
    setLoading(false);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleClose = () => {
    setOpen(false);
    resetState();
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target?.files?.[0];
    if (!file) return;

    // Check file type
    if (file.type !== "application/json" && !file.name.endsWith(".json")) {
      toast.error(t("environments.surveys.import_error_invalid_json"));
      return;
    }

    setLoading(true);
    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      setSurveyData(parsed);
      setSurveyName(parsed?.name || "Imported Survey");
      setNewName(`${parsed?.name || "Imported Survey"} (imported)`);

      // Validate the survey data
      const validationResult = await validateSurveyImportAction({
        surveyData: parsed,
        environmentId,
      });

      if (validationResult?.data) {
        setErrors(validationResult.data.errors || []);
        setWarnings(validationResult.data.warnings || []);

        if (validationResult.data.errors.length === 0) {
          // Generate a preview ID
          const previewId = createId();
          setNewSurveyId(previewId);
          setStep("preview");
        }
      }
    } catch (error) {
      logger.error(error);
      toast.error(t("environments.surveys.import_error_invalid_json"));
    } finally {
      setLoading(false);
    }
  };

  const handleImport = async () => {
    if (!surveyData || errors.length > 0) {
      return;
    }

    setLoading(true);
    try {
      const result = await importSurveyAction({
        surveyData,
        environmentId,
        newName,
      });

      if (result?.data) {
        toast.success(t("environments.surveys.import_survey_success"));
        onSurveyImported?.();
        router.refresh();
        handleClose();
      } else {
        const errorMessage = getFormattedErrorMessage(result);
        toast.error(errorMessage || t("environments.surveys.import_survey_error"));
      }
    } catch (error) {
      logger.error(error);
      toast.error(t("environments.surveys.import_survey_error"));
    } finally {
      setLoading(false);
    }
  };

  if (step === "upload") {
    return (
      <Dialog open={open} onOpenChange={handleClose}>
        <DialogContent className="w-full max-w-md">
          <DialogHeader>
            <DialogTitle>{t("environments.surveys.import_survey")}</DialogTitle>
            <DialogDescription>{t("environments.surveys.import_survey_description")}</DialogDescription>
          </DialogHeader>

          <DialogBody className="space-y-4">
            <div>
              <Label htmlFor="json-file">{t("environments.surveys.import_survey_file_label")}</Label>
              <div className="mt-2 flex items-center justify-center rounded-lg border-2 border-dashed border-slate-300 bg-slate-50 p-8">
                <div className="text-center">
                  <div className="mb-2 text-2xl">📄</div>
                  <input
                    ref={fileInputRef}
                    type="file"
                    id="json-file"
                    accept=".json"
                    onChange={handleFileSelect}
                    className="hidden"
                    disabled={loading}
                  />
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={loading}
                    loading={loading}>
                    {t("common.choose_file")}
                  </Button>
                  <p className="mt-2 text-sm text-slate-500">
                    {t("environments.surveys.or_drag_and_drop_json")}
                  </p>
                </div>
              </div>
            </div>
          </DialogBody>

          <DialogFooter>
            <Button variant="secondary" onClick={handleClose} disabled={loading}>
              {t("common.cancel")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="w-full max-w-2xl">
        <DialogHeader>
          <DialogTitle>{t("environments.surveys.import_survey")}</DialogTitle>
          <DialogDescription>{t("environments.surveys.import_survey_validate")}</DialogDescription>
        </DialogHeader>

        <DialogBody className="space-y-4">
          {errors.length > 0 && (
            <Alert variant="destructive" title={t("environments.surveys.import_survey_errors")}>
              <ul className="space-y-1">
                {errors.map((error) => (
                  <li key={error} className="text-sm">
                    • {t(`environments.surveys.${error}`)}
                  </li>
                ))}
              </ul>
            </Alert>
          )}

          {warnings.length > 0 && (
            <Alert variant="default" title={t("environments.surveys.import_survey_warnings")}>
              <ul className="space-y-1">
                {warnings.map((warning) => (
                  <li key={warning} className="text-sm">
                    • {t(`environments.surveys.${warning}`)}
                  </li>
                ))}
              </ul>
            </Alert>
          )}

          <div className="space-y-4 rounded-lg border border-slate-200 bg-slate-50 p-4">
            <div>
              <Label htmlFor="survey-name">{t("environments.surveys.import_survey_name_label")}</Label>
              <Input
                id="survey-name"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder={surveyName}
                disabled={loading}
                className="mt-2"
              />
            </div>

            <div>
              <Label>{t("environments.surveys.import_survey_new_id")}</Label>
              <div className="mt-2">
                <IdBadge id={newSurveyId} />
              </div>
            </div>
          </div>
        </DialogBody>

        <DialogFooter>
          <Button variant="secondary" onClick={() => setStep("upload")} disabled={loading}>
            {t("common.back")}
          </Button>
          <Button
            onClick={handleImport}
            disabled={errors.length > 0 || loading || !newName}
            loading={loading}>
            {t("environments.surveys.import_survey_import")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
