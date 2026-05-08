"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { TConnectorWithMappings } from "@formbricks/types/connector";
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
import {
  SAMPLE_CSV_COLUMNS,
  TFieldMapping,
  TFormbricksConnectorForm,
  TSourceField,
  TUnifySurvey,
  ZFormbricksConnectorForm,
} from "../types";
import {
  areAllRequiredFieldsMapped,
  isConnectorNameValid,
  parseCSVColumnsToFields,
  toggleQuestionId,
} from "../utils";
import { getConnectorIcon, getConnectorTypeLabelKey } from "./connector-display";
import { FormbricksQuestionList } from "./formbricks-question-list";
import { MappingUI } from "./mapping-ui";

interface EditConnectorModalProps {
  connector: TConnectorWithMappings | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpdateConnector: (data: {
    connectorId: string;
    workspaceId: string;
    name: string;
    surveyMappings?: { surveyId: string; elementIds: string[] }[];
    fieldMappings?: TFieldMapping[];
  }) => Promise<void>;
  surveys: TUnifySurvey[];
  onOpenCsvImport?: () => void;
}

export const EditConnectorModal = ({
  connector,
  open,
  onOpenChange,
  onUpdateConnector,
  surveys,
  onOpenCsvImport,
}: EditConnectorModalProps) => {
  const { t } = useTranslation();
  const [csvConnectorName, setCsvConnectorName] = useState("");
  const [mappings, setMappings] = useState<TFieldMapping[]>([]);
  const [sourceFields, setSourceFields] = useState<TSourceField[]>([]);
  const [isUpdating, setIsUpdating] = useState(false);

  const formbricksForm = useForm<TFormbricksConnectorForm>({
    resolver: zodResolver(ZFormbricksConnectorForm),
    defaultValues: {
      sourceName: "",
      surveyId: "",
      selectedQuestionIds: [],
      importHistorical: true,
    },
    mode: "onChange",
  });

  const formbricksValues = formbricksForm.watch();
  const selectedSurveyId = formbricksValues.surveyId;
  const selectedQuestionIds = formbricksValues.selectedQuestionIds ?? [];
  const selectedSurvey = useMemo(
    () => surveys.find((survey) => survey.id === selectedSurveyId) ?? null,
    [surveys, selectedSurveyId]
  );

  useEffect(() => {
    if (connector) {
      if (connector.type === "formbricks_survey") {
        const mappedSurveyId = connector.formbricksMappings[0]?.surveyId ?? "";
        const mappedQuestionIds = connector.formbricksMappings
          .filter((mapping) => mapping.surveyId === mappedSurveyId)
          .map((mapping) => mapping.elementId);

        formbricksForm.reset({
          sourceName: connector.name,
          surveyId: mappedSurveyId,
          selectedQuestionIds: mappedQuestionIds,
          importHistorical: true,
        });
        setCsvConnectorName("");
        setSourceFields([]);
        setMappings([]);
      } else if (connector.type === "csv") {
        setCsvConnectorName(connector.name);
        const columnsFromMappings = [
          ...new Set(connector.fieldMappings.map((m) => m.sourceFieldId).filter(Boolean)),
        ];
        setSourceFields(
          columnsFromMappings.length > 0
            ? parseCSVColumnsToFields(columnsFromMappings.join(","))
            : parseCSVColumnsToFields(SAMPLE_CSV_COLUMNS)
        );
        setMappings(
          connector.fieldMappings.map((m) => ({
            sourceFieldId: m.sourceFieldId,
            targetFieldId: m.targetFieldId,
            staticValue: m.staticValue ?? undefined,
          }))
        );
        formbricksForm.reset({
          sourceName: "",
          surveyId: "",
          selectedQuestionIds: [],
          importHistorical: true,
        });
      } else {
        setCsvConnectorName("");
        setSourceFields([]);
        setMappings([]);
        formbricksForm.reset({
          sourceName: "",
          surveyId: "",
          selectedQuestionIds: [],
          importHistorical: true,
        });
      }
    }
  }, [connector, formbricksForm]);

  const resetForm = () => {
    setCsvConnectorName("");
    setMappings([]);
    setSourceFields([]);
    formbricksForm.reset({
      sourceName: "",
      surveyId: "",
      selectedQuestionIds: [],
      importHistorical: true,
    });
    setIsUpdating(false);
  };

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      resetForm();
    }
    onOpenChange(newOpen);
  };

  const handleUpdateFormbricksConnector = async (values: TFormbricksConnectorForm) => {
    if (connector?.type !== "formbricks_survey") return;
    setIsUpdating(true);
    await onUpdateConnector({
      connectorId: connector.id,
      workspaceId: connector.workspaceId,
      name: values.sourceName.trim(),
      surveyMappings: [{ surveyId: values.surveyId, elementIds: values.selectedQuestionIds }],
      fieldMappings: undefined,
    });
    setIsUpdating(false);
    handleOpenChange(false);
  };

  const handleUpdateCsvConnector = async () => {
    if (connector?.type !== "csv" || !isConnectorNameValid(csvConnectorName)) return;
    setIsUpdating(true);
    await onUpdateConnector({
      connectorId: connector.id,
      workspaceId: connector.workspaceId,
      name: csvConnectorName.trim(),
      surveyMappings: undefined,
      fieldMappings: mappings.length > 0 ? mappings : undefined,
    });
    setIsUpdating(false);
    handleOpenChange(false);
  };

  const handleFormbricksQuestionToggle = (questionId: string) => {
    const nextSelection = toggleQuestionId(formbricksForm.getValues("selectedQuestionIds"), questionId);
    formbricksForm.setValue("selectedQuestionIds", nextSelection, {
      shouldDirty: true,
      shouldValidate: true,
    });
  };

  const saveChangesDisabled = useMemo(() => {
    if (!connector) return true;
    if (isUpdating) return true;

    if (connector.type === "formbricks_survey") {
      return (
        !isConnectorNameValid(formbricksValues.sourceName ?? "") ||
        !formbricksValues.surveyId ||
        !formbricksValues.selectedQuestionIds?.length
      );
    }

    if (connector.type === "csv") {
      return !isConnectorNameValid(csvConnectorName) || !areAllRequiredFieldsMapped(mappings);
    }

    return true;
  }, [connector, csvConnectorName, formbricksValues, isUpdating, mappings]);

  if (!connector) return null;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>{t("workspace.unify.edit_source_connection")}</DialogTitle>
          <DialogDescription>{t("workspace.unify.update_mapping_description")}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {connector.type === "formbricks_survey" ? (
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

                <FormField
                  control={formbricksForm.control}
                  name="surveyId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t("workspace.unify.select_survey")}</FormLabel>
                      <FormControl>
                        <Select value={field.value} onValueChange={field.onChange} disabled>
                          <SelectTrigger>
                            <SelectValue placeholder={t("workspace.unify.select_survey")} />
                          </SelectTrigger>
                          <SelectContent>
                            {selectedSurvey && (
                              <SelectItem key={selectedSurvey.id} value={selectedSurvey.id}>
                                {selectedSurvey.name}
                              </SelectItem>
                            )}
                            {!selectedSurvey && field.value && (
                              <SelectItem value={field.value}>{field.value}</SelectItem>
                            )}
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
              </form>
            </FormProvider>
          ) : (
            <>
              <div className="flex items-center gap-3 rounded-lg border border-slate-200 bg-slate-50 p-3">
                {getConnectorIcon(connector.type, "h-5 w-5 text-slate-500")}
                <div>
                  <p className="text-sm font-medium text-slate-900">
                    {t(getConnectorTypeLabelKey(connector.type))}
                  </p>
                  <p className="text-xs text-slate-500">
                    {t("workspace.unify.source_type_cannot_be_changed")}
                  </p>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="editConnectorName">{t("workspace.unify.source_name")}</Label>
                <Input
                  id="editConnectorName"
                  value={csvConnectorName}
                  onChange={(event) => setCsvConnectorName(event.target.value)}
                  placeholder={t("workspace.unify.enter_name_for_source")}
                />
              </div>

              <div className="max-h-[40vh] overflow-y-auto rounded-lg border border-slate-200 p-4">
                <MappingUI
                  sourceFields={sourceFields}
                  mappings={mappings}
                  onMappingsChange={setMappings}
                  connectorType={connector.type}
                />
              </div>
            </>
          )}
        </div>

        <DialogFooter>
          {connector.type === "csv" && (
            <Button
              variant="secondary"
              onClick={() => {
                handleOpenChange(false);
                onOpenCsvImport?.();
              }}>
              {t("workspace.unify.import_feedback")}
            </Button>
          )}
          <Button
            onClick={
              connector.type === "formbricks_survey"
                ? () => void formbricksForm.handleSubmit(handleUpdateFormbricksConnector)()
                : handleUpdateCsvConnector
            }
            disabled={saveChangesDisabled}>
            {t("workspace.unify.save_changes")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
