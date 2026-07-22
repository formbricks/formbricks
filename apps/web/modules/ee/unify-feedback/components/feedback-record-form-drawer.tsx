"use client";

import { LanguagesIcon, SparklesIcon } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "react-hot-toast";
import { useTranslation } from "react-i18next";
import { getLanguageLabel } from "@formbricks/i18n-utils/src/utils";
import { getFormattedErrorMessage } from "@/lib/utils/helper";
import {
  EMOTIONS_DIMENSION_ID,
  SENTIMENT_DIMENSION_ID,
  getTranslatedDimensionValueLabel,
} from "@/modules/ee/analysis/lib/schema-definition";
import type { FeedbackRecordData } from "@/modules/hub/types";
import { Button } from "@/modules/ui/components/button";
import { DeleteDialog } from "@/modules/ui/components/delete-dialog";
import { FormControl, FormField, FormItem, FormLabel, FormProvider } from "@/modules/ui/components/form";
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
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/modules/ui/components/sheet";
import { Switch } from "@/modules/ui/components/switch";
import { deleteFeedbackRecordAction, retrieveFeedbackRecordAction } from "../actions";
import { FIELD_TYPE_OPTIONS, type TFeedbackRecordFormValues } from "../lib/types";
import {
  formatSourceType,
  getReadOnlyMetadataEntries,
  getValueFieldByType,
  mapRecordToValues,
  resolveFeedbackDisplayText,
} from "../lib/utils";

interface FeedbackRecordFormDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workspaceId: string;
  directories: { id: string; name: string }[];
  canWrite: boolean;
  recordId?: string;
  onSuccess: () => Promise<void> | void;
}

export const FeedbackRecordFormDrawer = ({
  open,
  onOpenChange,
  workspaceId,
  directories,
  canWrite,
  recordId,
  onSuccess,
}: Readonly<FeedbackRecordFormDrawerProps>) => {
  const { t, i18n } = useTranslation();
  const locale = i18n.resolvedLanguage ?? i18n.language ?? "en-US";
  const [record, setRecord] = useState<FeedbackRecordData | null>(null);
  const [isLoadingRecord, setIsLoadingRecord] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const form = useForm<TFeedbackRecordFormValues>();

  const fieldType = form.watch("field_type");
  const selectedValueField = getValueFieldByType(fieldType);

  const readOnlyMetadataEntries = useMemo(() => (record ? getReadOnlyMetadataEntries(record) : []), [record]);

  // ENG-1253: show the Hub translation read-only beside the original. Shared resolver keeps the
  // empty/identical guards consistent with the other surfaces.
  const { isTranslated: hasTranslation, text: resolvedTranslatedText } = record
    ? resolveFeedbackDisplayText(record)
    : { isTranslated: false, text: null };
  const translatedText =
    selectedValueField === "value_text" && hasTranslation ? resolvedTranslatedText : null;
  const translatedLangLabel = record?.translation_lang_key
    ? (getLanguageLabel(record.translation_lang_key, locale) ?? record.translation_lang_key)
    : null;

  // Read-only AI enrichment (sentiment/emotions). Same "absent until enriched" contract as the
  // translation fields above; reuse the chart value-label maps so labels stay consistent everywhere.
  const sentimentLabel = record?.sentiment
    ? (getTranslatedDimensionValueLabel(SENTIMENT_DIMENSION_ID, record.sentiment, t) ?? record.sentiment)
    : null;
  const sentimentScoreLabel =
    typeof record?.sentiment_score === "number" ? record.sentiment_score.toFixed(2) : null;
  const emotions = record?.emotions;
  const emotionsRaw = Array.isArray(emotions) ? emotions.join(", ") : (emotions ?? "");
  const emotionsLabel = emotionsRaw
    ? (getTranslatedDimensionValueLabel(EMOTIONS_DIMENSION_ID, emotionsRaw, t) ?? emotionsRaw)
    : null;

  useEffect(() => {
    if (!open || !recordId) return;

    const loadRecord = async () => {
      setIsLoadingRecord(true);
      const result = await retrieveFeedbackRecordAction({ workspaceId, recordId });

      if (!result?.data) {
        toast.error(getFormattedErrorMessage(result) || t("workspace.unify.failed_to_load_feedback_records"));
        setIsLoadingRecord(false);
        onOpenChange(false);
        return;
      }

      setRecord(result.data);
      form.reset(mapRecordToValues(result.data));
      setIsLoadingRecord(false);
    };

    void loadRecord();
  }, [form, onOpenChange, open, recordId, t, workspaceId]);

  const handleDelete = async () => {
    if (!recordId) return;
    setIsDeleting(true);
    try {
      const result = await deleteFeedbackRecordAction({ workspaceId, recordId });
      if (!result?.data) {
        toast.error(getFormattedErrorMessage(result));
        return;
      }
      toast.success(t("workspace.unify.feedback_record_deleted_successfully"));
      setIsDeleteDialogOpen(false);
      await onSuccess();
      onOpenChange(false);
    } finally {
      setIsDeleting(false);
    }
  };

  const valueBooleanStatus = form.watch("value_boolean");
  let valueBooleanLabel = t("common.not_set");
  if (valueBooleanStatus === true) {
    valueBooleanLabel = t("common.yes");
  } else if (valueBooleanStatus === false) {
    valueBooleanLabel = t("common.no");
  }

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent className="w-full overflow-y-auto bg-white px-5 pb-16 sm:max-w-2xl">
          <SheetHeader>
            <SheetTitle>{t("workspace.unify.feedback_record_details")}</SheetTitle>
            <SheetDescription>{t("workspace.unify.feedback_record_details_description")}</SheetDescription>
          </SheetHeader>

          {isLoadingRecord || !record ? (
            <div className="py-8 text-sm text-slate-500">{t("common.loading")}</div>
          ) : (
            <FormProvider {...form}>
              <div className="space-y-4 py-4">
                <div className="grid grid-cols-2 gap-3">
                  <FormField
                    control={form.control}
                    name="id"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t("common.id")}</FormLabel>
                        <FormControl>
                          <Input {...field} disabled placeholder={t("workspace.unify.auto_generated")} />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="tenant_id"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t("workspace.unify.feedback_directory")}</FormLabel>
                        <FormControl>
                          <Select value={field.value} onValueChange={field.onChange} disabled>
                            <SelectTrigger>
                              <SelectValue placeholder={t("workspace.unify.select_feedback_directory")} />
                            </SelectTrigger>
                            <SelectContent>
                              {directories.map((directory) => (
                                <SelectItem key={directory.id} value={directory.id}>
                                  {directory.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </FormControl>
                      </FormItem>
                    )}
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <FormField
                    control={form.control}
                    name="submission_id"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t("workspace.unify.submission_id")}</FormLabel>
                        <FormControl>
                          <Input {...field} disabled />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="collected_at"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t("workspace.unify.collected_at")}</FormLabel>
                        <FormControl>
                          <Input {...field} type="datetime-local" disabled />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <FormField
                    control={form.control}
                    name="created_at"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t("common.created_at")}</FormLabel>
                        <FormControl>
                          <Input {...field} disabled placeholder={t("workspace.unify.auto_generated")} />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="updated_at"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t("workspace.unify.updated_at")}</FormLabel>
                        <FormControl>
                          <Input {...field} disabled placeholder={t("workspace.unify.auto_generated")} />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="source_type"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t("workspace.unify.source_type")}</FormLabel>
                      <FormControl>
                        <Input {...field} value={formatSourceType(field.value, t)} disabled />
                      </FormControl>
                    </FormItem>
                  )}
                />

                <div className="grid grid-cols-2 gap-3">
                  <FormField
                    control={form.control}
                    name="source_id"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t("workspace.unify.source_id")}</FormLabel>
                        <FormControl>
                          <Input {...field} disabled />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="source_name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t("workspace.unify.source_name")}</FormLabel>
                        <FormControl>
                          <Input {...field} disabled />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <FormField
                    control={form.control}
                    name="field_id"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t("workspace.unify.field_id")}</FormLabel>
                        <FormControl>
                          <Input {...field} disabled />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="field_label"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t("workspace.unify.field_label")}</FormLabel>
                        <FormControl>
                          <Input {...field} disabled />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <FormField
                    control={form.control}
                    name="field_type"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t("workspace.unify.field_type")}</FormLabel>
                        <FormControl>
                          <Select
                            value={field.value}
                            onValueChange={(value) =>
                              field.onChange(value as TFeedbackRecordFormValues["field_type"])
                            }
                            disabled>
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {FIELD_TYPE_OPTIONS.map((option) => (
                                <SelectItem key={option} value={option}>
                                  {option}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </FormControl>
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="field_group_id"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t("workspace.unify.field_group_id")}</FormLabel>
                        <FormControl>
                          <Input {...field} disabled />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="field_group_label"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t("workspace.unify.field_group_label")}</FormLabel>
                      <FormControl>
                        <Input {...field} disabled />
                      </FormControl>
                    </FormItem>
                  )}
                />

                <div className="grid grid-cols-2 gap-3">
                  <FormField
                    control={form.control}
                    name="value_text"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t("workspace.unify.value_text")}</FormLabel>
                        <FormControl>
                          <Input {...field} value={field.value ?? ""} disabled />
                        </FormControl>
                      </FormItem>
                    )}
                  />

                  {/* ENG-1673: read-only — the stable option identity is managed by ingestion/backfill;
                      hand-editing it would desync the record from its source option. Always shown so the
                      canonical Value ID is visible even when the record has none. */}
                  <div className="space-y-2">
                    <Label htmlFor="value_id" className="block text-slate-800">
                      {t("workspace.unify.value_id")}
                    </Label>
                    <Input id="value_id" value={record.value_id ?? ""} disabled readOnly />
                  </div>
                </div>

                {translatedText && (
                  <div className="space-y-1.5 rounded-md bg-slate-50 p-3">
                    <div className="flex items-center gap-2">
                      <LanguagesIcon className="size-3.5 text-slate-500" aria-hidden="true" />
                      <span className="text-sm font-medium text-slate-700">
                        {t("workspace.unify.translated_text")}
                      </span>
                      {translatedLangLabel && (
                        <span className="text-xs text-slate-500">{translatedLangLabel}</span>
                      )}
                    </div>
                    <p className="text-sm whitespace-pre-wrap text-slate-700">{translatedText}</p>
                    <p className="text-xs text-slate-400">{t("workspace.unify.translated_text_hint")}</p>
                  </div>
                )}

                {selectedValueField === "value_text" && (
                  <div className="space-y-1.5 rounded-md bg-slate-50 p-3">
                    <div className="flex items-center gap-2">
                      <SparklesIcon className="size-3.5 text-slate-500" aria-hidden="true" />
                      <span className="text-sm font-medium text-slate-700">
                        {t("workspace.unify.ai_enrichment")}
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm text-slate-500">{t("workspace.unify.sentiment")}</span>
                      {sentimentLabel ? (
                        <span className="text-sm text-slate-700">
                          {sentimentLabel}
                          {sentimentScoreLabel ? ` (${sentimentScoreLabel})` : ""}
                        </span>
                      ) : (
                        <span className="text-sm text-slate-400 italic">
                          {t("workspace.unify.not_enriched")}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm text-slate-500">{t("workspace.unify.emotions")}</span>
                      {emotionsLabel ? (
                        <span className="text-sm text-slate-700">{emotionsLabel}</span>
                      ) : (
                        <span className="text-sm text-slate-400 italic">
                          {t("workspace.unify.not_enriched")}
                        </span>
                      )}
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-3">
                  <FormField
                    control={form.control}
                    name="value_number"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t("workspace.unify.value_number")}</FormLabel>
                        <FormControl>
                          <Input {...field} value={field.value ?? ""} type="number" step="any" disabled />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="value_date"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t("workspace.unify.value_date")}</FormLabel>
                        <FormControl>
                          <Input {...field} value={field.value ?? ""} type="datetime-local" disabled />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="value_boolean"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t("workspace.unify.value_boolean")}</FormLabel>
                      <FormControl>
                        <div className="flex items-center gap-3 rounded-md border border-slate-200 px-3 py-2">
                          <Switch
                            checked={field.value ?? false}
                            onCheckedChange={(checked) => field.onChange(checked)}
                            disabled
                          />
                          <span className="text-sm text-slate-600">{valueBooleanLabel}</span>
                        </div>
                      </FormControl>
                    </FormItem>
                  )}
                />

                <div className="grid grid-cols-2 gap-3">
                  <FormField
                    control={form.control}
                    name="language"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t("common.language")}</FormLabel>
                        <FormControl>
                          <Input {...field} disabled />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="user_id"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t("workspace.unify.user_identifier")}</FormLabel>
                        <FormControl>
                          <Input {...field} disabled />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                </div>

                {readOnlyMetadataEntries.length > 0 && (
                  <div className="space-y-2">
                    <FormLabel>{t("workspace.unify.metadata")}</FormLabel>
                    <div className="space-y-2">
                      <p className="text-xs text-slate-500">
                        {t("workspace.unify.metadata_read_only_entries")}
                      </p>
                      {readOnlyMetadataEntries.map((entry) => (
                        <div
                          key={entry.key}
                          className="grid grid-cols-2 gap-2 rounded-md bg-slate-50 p-2 text-xs">
                          <span className="font-medium text-slate-700">{entry.key}</span>
                          <span className="truncate text-slate-600" title={entry.value}>
                            {entry.value}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </FormProvider>
          )}

          <SheetFooter className="mt-2 sm:justify-between">
            {canWrite && recordId ? (
              <Button
                variant="destructive"
                onClick={() => setIsDeleteDialogOpen(true)}
                disabled={isLoadingRecord || isDeleting}>
                {t("common.delete")}
              </Button>
            ) : (
              <span />
            )}
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isDeleting}>
              {t("common.close")}
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      <DeleteDialog
        open={isDeleteDialogOpen}
        setOpen={setIsDeleteDialogOpen}
        deleteWhat={t("workspace.unify.delete_feedback_record")}
        text={t("workspace.unify.delete_feedback_record_confirmation")}
        onDelete={handleDelete}
        isDeleting={isDeleting}
      />
    </>
  );
};
