"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { PlusIcon } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useFieldArray, useForm } from "react-hook-form";
import { toast } from "react-hot-toast";
import { useTranslation } from "react-i18next";
import { getFormattedErrorMessage } from "@/lib/utils/helper";
import type { FeedbackRecordData } from "@/modules/hub/types";
import { AlertDialog } from "@/modules/ui/components/alert-dialog";
import { Button } from "@/modules/ui/components/button";
import { DeleteDialog } from "@/modules/ui/components/delete-dialog";
import {
  FormControl,
  FormError,
  FormField,
  FormItem,
  FormLabel,
  FormProvider,
} from "@/modules/ui/components/form";
import { Input } from "@/modules/ui/components/input";
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
import {
  createFeedbackRecordAction,
  deleteFeedbackRecordAction,
  retrieveFeedbackRecordAction,
  updateFeedbackRecordAction,
} from "../actions";
import {
  FIELD_TYPE_OPTIONS,
  SOURCE_TYPE_CUSTOM_VALUE,
  SOURCE_TYPE_PRESET_OPTIONS,
  type TFeedbackRecordFormValues,
  ZFeedbackRecordFormValues,
} from "../lib/types";
import {
  formatSourceType,
  getCreateDefaults,
  getReadOnlyMetadataEntries,
  getValueFieldByType,
  isPresetSourceType,
  mapRecordToValues,
  parseNumberValue,
  toISOOrUndefined,
} from "../lib/utils";
import { type TFeedbackRecordUpdateInput } from "../types";

type FeedbackRecordDrawerMode = "create" | "edit";

interface FeedbackRecordFormDrawerProps {
  mode: FeedbackRecordDrawerMode;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workspaceId: string;
  directories: { id: string; name: string }[];
  canWrite: boolean;
  recordId?: string;
  onSuccess: () => Promise<void> | void;
}

export const FeedbackRecordFormDrawer = ({
  mode,
  open,
  onOpenChange,
  workspaceId,
  directories,
  canWrite,
  recordId,
  onSuccess,
}: Readonly<FeedbackRecordFormDrawerProps>) => {
  const { t } = useTranslation();
  const [record, setRecord] = useState<FeedbackRecordData | null>(null);
  const [isLoadingRecord, setIsLoadingRecord] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDiscardDialogOpen, setIsDiscardDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const defaultValues = useMemo(() => getCreateDefaults(directories), [directories]);

  const form = useForm<TFeedbackRecordFormValues>({
    resolver: zodResolver(ZFeedbackRecordFormValues),
    defaultValues,
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "metadataEntries",
  });

  const fieldType = form.watch("field_type");
  const selectedValueField = getValueFieldByType(fieldType);
  const isEditMode = mode === "edit";
  const isReadOnly = isEditMode && !canWrite;

  const [sourceTypeMode, setSourceTypeMode] = useState<string>("survey");
  const [customSourceType, setCustomSourceType] = useState("");

  const readOnlyMetadataEntries = useMemo(() => (record ? getReadOnlyMetadataEntries(record) : []), [record]);

  const resetForCreate = useCallback(() => {
    const nextDefaults = getCreateDefaults(directories);
    form.reset(nextDefaults);
    setRecord(null);
    setSourceTypeMode(nextDefaults.source_type);
    setCustomSourceType("");
  }, [directories, form]);

  useEffect(() => {
    if (!open) return;

    if (mode === "create") {
      resetForCreate();
      return;
    }

    if (!recordId) return;

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
      const isPreset = isPresetSourceType(result.data.source_type);
      setSourceTypeMode(isPreset ? result.data.source_type : SOURCE_TYPE_CUSTOM_VALUE);
      setCustomSourceType(isPreset ? "" : result.data.source_type);
      setIsLoadingRecord(false);
    };

    void loadRecord();
  }, [form, mode, onOpenChange, open, recordId, resetForCreate, t, workspaceId]);

  const requestClose = useCallback(() => {
    if (form.formState.isDirty && !isSubmitting) {
      setIsDiscardDialogOpen(true);
      return;
    }

    onOpenChange(false);
  }, [form.formState.isDirty, isSubmitting, onOpenChange]);

  const handleDrawerOpenChange = useCallback(
    (nextOpen: boolean) => {
      if (nextOpen) {
        onOpenChange(true);
        return;
      }

      requestClose();
    },
    [onOpenChange, requestClose]
  );

  const handleDiscardChanges = () => {
    setIsDiscardDialogOpen(false);
    onOpenChange(false);
  };

  const setStrictValueValidationError = (message: string) => {
    form.setError(selectedValueField, { type: "manual", message });
  };

  const isCreateValueFieldValid = (values: TFeedbackRecordFormValues): boolean => {
    if (selectedValueField === "value_text") return Boolean(values.value_text?.trim());
    if (selectedValueField === "value_number") return parseNumberValue(values.value_number ?? "") != null;
    if (selectedValueField === "value_boolean") return values.value_boolean !== undefined;
    if (selectedValueField === "value_date") return Boolean(toISOOrUndefined(values.value_date));
    return true;
  };

  const buildMetadataMap = (values: TFeedbackRecordFormValues): Record<string, string> =>
    Object.fromEntries(
      values.metadataEntries
        .map((entry) => ({ key: entry.key.trim(), value: entry.value }))
        .filter((entry) => entry.key.length > 0)
        .map((entry) => [entry.key, entry.value])
    );

  const buildCreateValueFields = (values: TFeedbackRecordFormValues) => ({
    value_text: selectedValueField === "value_text" ? (values.value_text ?? "") : null,
    value_number:
      selectedValueField === "value_number"
        ? (parseNumberValue(values.value_number ?? "") ?? undefined)
        : undefined,
    value_boolean: selectedValueField === "value_boolean" ? values.value_boolean : undefined,
    value_date: selectedValueField === "value_date" ? toISOOrUndefined(values.value_date) : undefined,
  });

  const getUpdateValueField = (
    values: TFeedbackRecordFormValues
  ): Pick<TFeedbackRecordUpdateInput, "value_text" | "value_number" | "value_boolean" | "value_date"> => {
    if (selectedValueField === "value_text") return { value_text: values.value_text?.trim() ?? "" };
    if (selectedValueField === "value_number") {
      return { value_number: parseNumberValue(values.value_number ?? "") };
    }
    if (selectedValueField === "value_boolean") return { value_boolean: values.value_boolean ?? null };
    if (selectedValueField === "value_date") {
      return { value_date: toISOOrUndefined(values.value_date) ?? null };
    }
    return {};
  };

  const submitCreate = async (
    values: TFeedbackRecordFormValues,
    metadata: Record<string, string>
  ): Promise<boolean> => {
    const sourceTypeValue =
      sourceTypeMode === SOURCE_TYPE_CUSTOM_VALUE ? customSourceType.trim() : values.source_type;

    const result = await createFeedbackRecordAction({
      workspaceId,
      recordInput: {
        submission_id: values.submission_id.trim(),
        tenant_id: values.tenant_id,
        source_type: sourceTypeValue,
        source_id: values.source_id?.trim() ? values.source_id.trim() : null,
        source_name: values.source_name?.trim() ? values.source_name.trim() : null,
        field_id: values.field_id.trim(),
        field_label: values.field_label?.trim() ? values.field_label.trim() : null,
        field_type: values.field_type,
        field_group_id: values.field_group_id?.trim() || undefined,
        field_group_label: values.field_group_label?.trim() ? values.field_group_label.trim() : null,
        collected_at: toISOOrUndefined(values.collected_at),
        ...buildCreateValueFields(values),
        metadata: Object.keys(metadata).length > 0 ? metadata : undefined,
        language: values.language?.trim() || undefined,
        user_id: values.user_id?.trim() || undefined,
      },
    });

    if (!result?.data) {
      toast.error(getFormattedErrorMessage(result));
      return false;
    }
    return true;
  };

  const submitUpdate = async (
    values: TFeedbackRecordFormValues,
    metadata: Record<string, string>
  ): Promise<boolean> => {
    if (!recordId) return false;

    const preservedMetadata = Object.fromEntries(
      Object.entries(record?.metadata ?? {}).filter(([, value]) => typeof value !== "string")
    );

    const result = await updateFeedbackRecordAction({
      workspaceId,
      recordId,
      updateInput: {
        language: values.language?.trim() || null,
        user_id: values.user_id?.trim() || null,
        metadata: { ...preservedMetadata, ...metadata },
        ...getUpdateValueField(values),
      },
    });

    if (!result?.data) {
      toast.error(getFormattedErrorMessage(result));
      return false;
    }
    return true;
  };

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

  const handleSubmit = form.handleSubmit(async (values) => {
    form.clearErrors();

    if (mode === "create" && !isCreateValueFieldValid(values)) {
      setStrictValueValidationError(t("workspace.unify.feedback_record_value_required"));
      return;
    }

    const metadata = buildMetadataMap(values);

    setIsSubmitting(true);
    try {
      const ok =
        mode === "create" ? await submitCreate(values, metadata) : await submitUpdate(values, metadata);
      if (!ok) return;

      toast.success(
        mode === "create"
          ? t("workspace.unify.feedback_record_created_successfully")
          : t("workspace.unify.feedback_record_updated_successfully")
      );
      await onSuccess();
      onOpenChange(false);
    } finally {
      setIsSubmitting(false);
    }
  });

  const drawerTitle =
    mode === "create"
      ? t("workspace.unify.add_feedback_record")
      : t("workspace.unify.feedback_record_details");

  const drawerDescription =
    mode === "create"
      ? t("workspace.unify.add_feedback_record_description")
      : t("workspace.unify.feedback_record_details_description");

  const valueBooleanStatus = form.watch("value_boolean");
  let valueBooleanLabel = t("common.not_set");
  if (valueBooleanStatus === true) {
    valueBooleanLabel = t("common.yes");
  } else if (valueBooleanStatus === false) {
    valueBooleanLabel = t("common.no");
  }

  return (
    <>
      <Sheet open={open} onOpenChange={handleDrawerOpenChange}>
        <SheetContent className="w-full overflow-y-auto bg-white px-5 sm:max-w-2xl">
          <SheetHeader>
            <SheetTitle>{drawerTitle}</SheetTitle>
            <SheetDescription>{drawerDescription}</SheetDescription>
          </SheetHeader>

          {isLoadingRecord ? (
            <div className="py-8 text-sm text-slate-500">{t("common.loading")}</div>
          ) : (
            <FormProvider {...form}>
              <form className="space-y-4 py-4" onSubmit={handleSubmit}>
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
                        <FormError />
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
                          <Input {...field} disabled={isEditMode || !canWrite} />
                        </FormControl>
                        <FormError />
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
                          <Input {...field} type="datetime-local" disabled={isEditMode || !canWrite} />
                        </FormControl>
                        <FormError />
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

                {isEditMode ? (
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
                ) : (
                  <div className="space-y-2">
                    <FormLabel>{t("workspace.unify.source_type")}</FormLabel>
                    <Select
                      value={sourceTypeMode}
                      onValueChange={(value) => {
                        setSourceTypeMode(value);
                        if (value !== SOURCE_TYPE_CUSTOM_VALUE) {
                          form.setValue("source_type", value, { shouldDirty: true });
                        }
                      }}
                      disabled={!canWrite}>
                      <SelectTrigger>
                        <SelectValue placeholder={t("workspace.unify.select_feedback_record_source_type")} />
                      </SelectTrigger>
                      <SelectContent>
                        {SOURCE_TYPE_PRESET_OPTIONS.map((option) => (
                          <SelectItem key={option} value={option}>
                            {formatSourceType(option, t)}
                          </SelectItem>
                        ))}
                        <SelectItem value={SOURCE_TYPE_CUSTOM_VALUE}>
                          {t("workspace.unify.custom_source_type")}
                        </SelectItem>
                      </SelectContent>
                    </Select>
                    {sourceTypeMode === SOURCE_TYPE_CUSTOM_VALUE && (
                      <Input
                        value={customSourceType}
                        onChange={(event) => {
                          setCustomSourceType(event.target.value);
                          form.setValue("source_type", event.target.value, { shouldDirty: true });
                        }}
                        placeholder={t("workspace.unify.custom_source_type_placeholder")}
                        disabled={!canWrite}
                      />
                    )}
                    <FormError>{form.formState.errors.source_type?.message}</FormError>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-3">
                  <FormField
                    control={form.control}
                    name="source_id"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t("workspace.unify.source_id")}</FormLabel>
                        <FormControl>
                          <Input {...field} disabled={isEditMode || !canWrite} />
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
                          <Input {...field} disabled={isEditMode || !canWrite} />
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
                          <Input {...field} disabled={isEditMode || !canWrite} />
                        </FormControl>
                        <FormError />
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
                          <Input {...field} disabled={isEditMode || !canWrite} />
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
                            disabled={isEditMode || !canWrite}>
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
                          <Input {...field} disabled={isEditMode || !canWrite} />
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
                        <Input {...field} disabled={isEditMode || !canWrite} />
                      </FormControl>
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="value_text"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t("workspace.unify.value_text")}</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          value={field.value ?? ""}
                          disabled={selectedValueField !== "value_text" || isReadOnly || !canWrite}
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />

                <div className="grid grid-cols-2 gap-3">
                  <FormField
                    control={form.control}
                    name="value_number"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t("workspace.unify.value_number")}</FormLabel>
                        <FormControl>
                          <Input
                            {...field}
                            value={field.value ?? ""}
                            type="number"
                            step="any"
                            disabled={selectedValueField !== "value_number" || isReadOnly || !canWrite}
                          />
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
                          <Input
                            {...field}
                            value={field.value ?? ""}
                            type="datetime-local"
                            disabled={selectedValueField !== "value_date" || isReadOnly || !canWrite}
                          />
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
                            disabled={selectedValueField !== "value_boolean" || isReadOnly || !canWrite}
                          />
                          <span className="text-sm text-slate-600">{valueBooleanLabel}</span>
                        </div>
                      </FormControl>
                    </FormItem>
                  )}
                />
                <FormError>{form.formState.errors[selectedValueField]?.message}</FormError>

                <div className="grid grid-cols-2 gap-3">
                  <FormField
                    control={form.control}
                    name="language"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t("common.language")}</FormLabel>
                        <FormControl>
                          <Input {...field} disabled={!canWrite || isReadOnly} />
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
                          <Input {...field} disabled={!canWrite || isReadOnly} />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <FormLabel>{t("workspace.unify.metadata")}</FormLabel>
                    {canWrite && !isReadOnly && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => append({ key: "", value: "" })}>
                        <PlusIcon className="h-4 w-4" />
                        {t("common.add")}
                      </Button>
                    )}
                  </div>

                  <div className="space-y-2">
                    {fields.map((field, index) => (
                      <div key={field.id} className="grid grid-cols-[1fr_1fr_auto] gap-2">
                        <FormField
                          control={form.control}
                          name={`metadataEntries.${index}.key`}
                          render={({ field: entryField }) => (
                            <FormItem>
                              <FormControl>
                                <Input
                                  {...entryField}
                                  placeholder={t("workspace.unify.metadata_key")}
                                  disabled={isReadOnly || !canWrite}
                                />
                              </FormControl>
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name={`metadataEntries.${index}.value`}
                          render={({ field: entryField }) => (
                            <FormItem>
                              <FormControl>
                                <Input
                                  {...entryField}
                                  placeholder={t("workspace.unify.metadata_value")}
                                  disabled={isReadOnly || !canWrite}
                                />
                              </FormControl>
                            </FormItem>
                          )}
                        />
                        {canWrite && !isReadOnly && (
                          <Button type="button" variant="outline" onClick={() => remove(index)}>
                            {t("common.delete")}
                          </Button>
                        )}
                      </div>
                    ))}
                  </div>

                  {readOnlyMetadataEntries.length > 0 && (
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
                  )}
                </div>
              </form>
            </FormProvider>
          )}

          <SheetFooter className="mt-2 sm:justify-between">
            {isEditMode && canWrite && recordId ? (
              <Button
                variant="destructive"
                onClick={() => setIsDeleteDialogOpen(true)}
                disabled={isSubmitting || isLoadingRecord || isDeleting}>
                {t("common.delete")}
              </Button>
            ) : (
              <span />
            )}
            <div className="flex gap-2">
              <Button variant="outline" onClick={requestClose} disabled={isSubmitting}>
                {t("common.cancel")}
              </Button>
              {canWrite && (
                <Button onClick={handleSubmit} loading={isSubmitting} disabled={isLoadingRecord}>
                  {mode === "create" ? t("workspace.unify.add_feedback_record") : t("common.save")}
                </Button>
              )}
            </div>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      <AlertDialog
        open={isDiscardDialogOpen}
        setOpen={setIsDiscardDialogOpen}
        headerText={t("workspace.unify.discard_feedback_record_changes_title")}
        mainText={t("workspace.unify.discard_feedback_record_changes_description")}
        confirmBtnLabel={t("common.discard")}
        declineBtnLabel={t("common.cancel")}
        declineBtnVariant="outline"
        onDecline={() => setIsDiscardDialogOpen(false)}
        onConfirm={handleDiscardChanges}
      />

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
