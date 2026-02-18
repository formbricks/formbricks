"use client";

import {
  FileSpreadsheetIcon,
  GlobeIcon,
  MailIcon,
  MessageSquareIcon,
  SparklesIcon,
  WebhookIcon,
} from "lucide-react";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Badge } from "@/modules/ui/components/badge";
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
import {
  AI_SUGGESTED_MAPPINGS,
  FEEDBACK_RECORD_FIELDS,
  SAMPLE_CSV_COLUMNS,
  TFieldMapping,
  TSourceConnection,
  TSourceField,
  TSourceType,
  TUnifySurvey,
} from "../types";
import { parseCSVColumnsToFields } from "../utils";
import { FormbricksSurveySelector } from "./formbricks-survey-selector";
import { MappingUI } from "./mapping-ui";

interface EditSourceModalProps {
  source: TSourceConnection | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpdateSource: (
    source: TSourceConnection,
    selectedSurveyId?: string,
    selectedElementIds?: string[]
  ) => void;
  onDeleteSource: (sourceId: string) => void;
  surveys: TUnifySurvey[];
  initialSurveyId?: string | null;
  initialElementIds?: string[];
}

function getSourceIcon(type: TSourceType) {
  switch (type) {
    case "formbricks":
      return <GlobeIcon className="h-5 w-5 text-slate-500" />;
    case "webhook":
      return <WebhookIcon className="h-5 w-5 text-slate-500" />;
    case "email":
      return <MailIcon className="h-5 w-5 text-slate-500" />;
    case "csv":
      return <FileSpreadsheetIcon className="h-5 w-5 text-slate-500" />;
    case "slack":
      return <MessageSquareIcon className="h-5 w-5 text-slate-500" />;
    default:
      return <GlobeIcon className="h-5 w-5 text-slate-500" />;
  }
}

function getSourceTypeLabelKey(type: TSourceType): string {
  switch (type) {
    case "formbricks":
      return "environments.unify.formbricks_surveys";
    case "webhook":
      return "environments.unify.webhook";
    case "email":
      return "environments.unify.email";
    case "csv":
      return "environments.unify.csv_import";
    case "slack":
      return "environments.unify.slack_message";
    default:
      return type;
  }
}

export function EditSourceModal({
  source,
  open,
  onOpenChange,
  onUpdateSource,
  onDeleteSource,
  surveys,
  initialSurveyId,
  initialElementIds = [],
}: EditSourceModalProps) {
  const { t } = useTranslation();
  const [sourceName, setSourceName] = useState("");
  const [mappings, setMappings] = useState<TFieldMapping[]>([]);
  const [sourceFields, setSourceFields] = useState<TSourceField[]>([]);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // Formbricks-specific state
  const [selectedSurveyId, setSelectedSurveyId] = useState<string | null>(null);
  const [selectedElementIds, setSelectedElementIds] = useState<string[]>([]);

  useEffect(() => {
    if (source) {
      setSourceName(source.name);
      setMappings(source.mappings);

      if (source.type === "formbricks") {
        setSelectedSurveyId(initialSurveyId ?? null);
        setSelectedElementIds(initialElementIds);
        setSourceFields([]);
      } else if (source.type === "csv") {
        setSourceFields(parseCSVColumnsToFields(SAMPLE_CSV_COLUMNS));
      } else {
        setSourceFields([]);
      }
    }
  }, [source, initialSurveyId, initialElementIds]);

  const resetForm = () => {
    setSourceName("");
    setMappings([]);
    setSourceFields([]);
    setShowDeleteConfirm(false);
    setSelectedSurveyId(null);
    setSelectedElementIds([]);
  };

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      resetForm();
    }
    onOpenChange(newOpen);
  };

  const handleSurveySelect = (surveyId: string | null) => {
    setSelectedSurveyId(surveyId);
  };

  const handleElementToggle = (elementId: string) => {
    setSelectedElementIds((prev) =>
      prev.includes(elementId) ? prev.filter((id) => id !== elementId) : [...prev, elementId]
    );
  };

  const handleSelectAllElements = (surveyId: string) => {
    const survey = surveys.find((s) => s.id === surveyId);
    if (survey) {
      setSelectedElementIds(survey.elements.map((e) => e.id));
    }
  };

  const handleDeselectAllElements = () => {
    setSelectedElementIds([]);
  };

  const handleUpdateSource = () => {
    if (!source || !sourceName.trim()) return;

    const updatedSource: TSourceConnection = {
      ...source,
      name: sourceName.trim(),
      mappings,
      updatedAt: new Date(),
    };

    if (source.type === "formbricks") {
      onUpdateSource(updatedSource, selectedSurveyId ?? undefined, selectedElementIds);
    } else {
      onUpdateSource(updatedSource);
    }
    handleOpenChange(false);
  };

  const handleDeleteSource = () => {
    if (!source) return;
    onDeleteSource(source.id);
    handleOpenChange(false);
  };

  const handleSuggestMapping = () => {
    if (!source) return;
    const suggestions = AI_SUGGESTED_MAPPINGS[source.type];
    if (!suggestions) return;

    const newMappings: TFieldMapping[] = [];

    for (const sourceField of sourceFields) {
      const suggestedTarget = suggestions.fieldMappings[sourceField.id];
      if (suggestedTarget) {
        const targetExists = FEEDBACK_RECORD_FIELDS.find((f) => f.id === suggestedTarget);
        if (targetExists) {
          newMappings.push({
            sourceFieldId: sourceField.id,
            targetFieldId: suggestedTarget,
          });
        }
      }
    }

    for (const [targetFieldId, staticValue] of Object.entries(suggestions.staticValues)) {
      const targetExists = FEEDBACK_RECORD_FIELDS.find((f) => f.id === targetFieldId);
      if (targetExists) {
        if (!newMappings.some((m) => m.targetFieldId === targetFieldId)) {
          newMappings.push({
            targetFieldId,
            staticValue,
          });
        }
      }
    }

    setMappings(newMappings);
  };

  if (!source) return null;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>{t("environments.unify.edit_source_connection")}</DialogTitle>
          <DialogDescription>{t("environments.unify.update_mapping_description")}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Source Type Display */}
          <div className="flex items-center gap-3 rounded-lg border border-slate-200 bg-slate-50 p-3">
            {getSourceIcon(source.type)}
            <div>
              <p className="text-sm font-medium text-slate-900">{t(getSourceTypeLabelKey(source.type))}</p>
              <p className="text-xs text-slate-500">
                {t("environments.unify.source_type_cannot_be_changed")}
              </p>
            </div>
          </div>

          {/* Source Name */}
          <div className="space-y-2">
            <Label htmlFor="editSourceName">{t("environments.unify.source_name")}</Label>
            <Input
              id="editSourceName"
              value={sourceName}
              onChange={(e) => setSourceName(e.target.value)}
              placeholder={t("environments.unify.enter_name_for_source")}
            />
          </div>

          {source.type === "formbricks" ? (
            <div className="max-h-[50vh] overflow-y-auto rounded-lg border border-slate-200 bg-slate-50 p-4">
              <FormbricksSurveySelector
                surveys={surveys}
                selectedSurveyId={selectedSurveyId}
                selectedElementIds={selectedElementIds}
                onSurveySelect={handleSurveySelect}
                onElementToggle={handleElementToggle}
                onSelectAllElements={handleSelectAllElements}
                onDeselectAllElements={handleDeselectAllElements}
              />
            </div>
          ) : (
            <>
              {/* Action buttons */}
              <div className="flex items-center justify-between">
                <div className="flex gap-2">
                  {sourceFields.length > 0 && (
                    <Button variant="outline" size="sm" onClick={handleSuggestMapping} className="gap-2">
                      <SparklesIcon className="h-4 w-4 text-purple-500" />
                      {t("environments.unify.suggest_mapping")}
                      <Badge text="AI" type="gray" size="tiny" className="ml-1" />
                    </Button>
                  )}
                </div>
              </div>

              {/* Mapping UI */}
              <div className="max-h-[50vh] overflow-y-auto rounded-lg border border-slate-200 bg-slate-50 p-4">
                <MappingUI
                  sourceFields={sourceFields}
                  mappings={mappings}
                  onMappingsChange={setMappings}
                  sourceType={source.type}
                />
              </div>
            </>
          )}
        </div>

        <DialogFooter className="flex justify-between">
          <div>
            {showDeleteConfirm ? (
              <div className="flex items-center gap-2">
                <span className="text-sm text-red-600">{t("environments.unify.are_you_sure")}</span>
                <Button variant="destructive" size="sm" onClick={handleDeleteSource}>
                  {t("environments.unify.yes_delete")}
                </Button>
                <Button variant="outline" size="sm" onClick={() => setShowDeleteConfirm(false)}>
                  {t("common.cancel")}
                </Button>
              </div>
            ) : (
              <Button variant="outline" onClick={() => setShowDeleteConfirm(true)}>
                {t("environments.unify.delete_source")}
              </Button>
            )}
          </div>
          <Button
            onClick={handleUpdateSource}
            disabled={
              !sourceName.trim() ||
              (source.type === "formbricks" && (!selectedSurveyId || selectedElementIds.length === 0))
            }>
            {t("environments.unify.save_changes")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
