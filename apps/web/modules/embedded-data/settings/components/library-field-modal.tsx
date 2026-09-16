"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { createId } from "@paralleldrive/cuid2";
import { useState } from "react";
import { type SubmitHandler, useForm } from "react-hook-form";
import toast from "react-hot-toast";
import { useTranslation } from "react-i18next";
import { z } from "zod";
import {
  type TEmbeddedDataSource,
  type TEmbeddedDataType,
  ZEmbeddedData,
  ZEmbeddedDataSource,
  ZEmbeddedDataType,
} from "@formbricks/types/embedded-data";
import { toSafeIdentifier } from "@formbricks/types/safe-identifier";
import { formatLocalDay, parseStoredDay } from "@/lib/utils/datetime";
import { getFormattedErrorMessage } from "@/lib/utils/helper";
import {
  createSharedEmbeddedDataAction,
  updateSharedEmbeddedDataAction,
} from "@/modules/embedded-data/actions";
import type { TSharedEmbeddedData, TSharedEmbeddedDataWriteResult } from "@/modules/embedded-data/types";
import { AdvancedOptionToggle } from "@/modules/ui/components/advanced-option-toggle";
import { Badge } from "@/modules/ui/components/badge";
import { Button } from "@/modules/ui/components/button";
import { ConfirmationModal } from "@/modules/ui/components/confirmation-modal";
import { DatePicker } from "@/modules/ui/components/date-picker";
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
  FormDescription,
  FormError,
  FormField,
  FormItem,
  FormLabel,
  FormProvider,
} from "@/modules/ui/components/form";
import { Input } from "@/modules/ui/components/input";
import { Label } from "@/modules/ui/components/label";
import { RadioGroup, RadioGroupItem } from "@/modules/ui/components/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/modules/ui/components/select";
import {
  formatDefaultValueDraft,
  getAuthorableSources,
  getDataTypesForSource,
  isLockableSource,
  narrowDataTypeToSource,
  parseDefaultValueDraft,
} from "../lib/library-field";
import { getDataTypeLabel, getSourceIcon, getSourceLabel } from "./field-display";

/**
 * Create and edit in one component, because the two dialogs differ only in what is fixed.
 *
 * `key` and `source` are set once — a survey addresses a field's value by a `storageKey` whose shape
 * follows the source, so changing either would point every linked survey at data it can no longer
 * read. Edit therefore renders them as prose rather than as disabled inputs the author would keep
 * trying to type into.
 */

/** Every control's value as the DOM holds it — strings, even where the stored column is not one. */
type TLibraryFieldDraft = {
  name: string;
  key: string;
  description: string;
  source: TEmbeddedDataSource;
  dataType: TEmbeddedDataType;
  defaultValue: string;
  locked: boolean;
};

/**
 * Columns the form does not collect. Real cuid2s because `ZEmbeddedData` checks them as such; they
 * never reach the server, which mints its own.
 */
const CANDIDATE_COLUMNS = { id: createId(), workspaceId: createId(), surveyId: null } as const;

const toCandidateRow = (draft: TLibraryFieldDraft) => ({
  ...CANDIDATE_COLUMNS,
  createdAt: new Date(),
  updatedAt: new Date(),
  key: draft.key,
  name: draft.name,
  description: draft.description.trim() === "" ? null : draft.description,
  source: draft.source,
  dataType: draft.dataType,
  defaultValue: parseDefaultValueDraft(draft.defaultValue, draft.dataType),
  locked: draft.locked,
});

/**
 * The draft's shape, with every actual rule delegated to `ZEmbeddedData`.
 *
 * This is the same schema `assertValidRow` runs in the service, over the same prospective row, so
 * the inline message and the one a refused write would have returned are the same sentence — the key
 * charset, the reserved-name list, the default that has to agree with `dataType`, locking only an
 * ingested field, and a calculated field being text or number are all defined exactly once, there.
 *
 * Issue paths are forwarded as they arrive: every column the schema can complain about on this form
 * is a control the form renders. The fallback covers the columns `toCandidateRow` supplies itself,
 * which is unreachable unless that builder is wrong — and putting the schema's own sentence on the
 * first field beats a form that refuses to submit with nothing on screen.
 */
const ZLibraryFieldDraft = z
  .object({
    name: z.string(),
    key: z.string(),
    description: z.string(),
    source: ZEmbeddedDataSource,
    dataType: ZEmbeddedDataType,
    defaultValue: z.string(),
    locked: z.boolean(),
  })
  .superRefine((draft, ctx) => {
    const parsed = ZEmbeddedData.safeParse(toCandidateRow(draft));
    if (parsed.success) return;

    const draftKeys = new Set(["name", "key", "description", "source", "dataType", "defaultValue", "locked"]);
    for (const issue of parsed.error.issues) {
      const [column] = issue.path;
      ctx.addIssue({
        code: "custom",
        message: issue.message,
        path: [typeof column === "string" && draftKeys.has(column) ? column : "name"],
      });
    }
  });

/** Radix refuses an empty item value, so "no default" travels as a sentinel and is mapped back. */
const NO_DEFAULT_VALUE = "__no_default__";

const toDraft = (field: TSharedEmbeddedData | null): TLibraryFieldDraft => ({
  name: field?.name ?? "",
  key: field?.key ?? "",
  description: field?.description ?? "",
  source: field?.source ?? "ingested",
  dataType: field?.dataType ?? "string",
  defaultValue: formatDefaultValueDraft(field?.defaultValue ?? null),
  locked: field?.locked ?? false,
});

interface LibraryFieldModalProps {
  workspaceId: string;
  /** The field being edited, or null for the create dialog. */
  field: TSharedEmbeddedData | null;
  open: boolean;
  setOpen: (open: boolean) => void;
  /** App locale — the date default's picker formats against it. */
  locale: string;
  onSaved: () => void;
}

export const LibraryFieldModal = ({
  workspaceId,
  field,
  open,
  setOpen,
  locale,
  onSaved,
}: Readonly<LibraryFieldModalProps>) => {
  const { t } = useTranslation();
  const isEdit = field !== null;
  // The dataType change the server refused, held until the author has seen which surveys it touches.
  const [pendingTypeChange, setPendingTypeChange] = useState<{
    draft: TLibraryFieldDraft;
    surveyCount: number;
  } | null>(null);
  // The retry runs outside `handleSubmit`, so `formState.isSubmitting` does not cover it.
  const [isConfirming, setIsConfirming] = useState(false);

  const form = useForm<TLibraryFieldDraft>({
    defaultValues: toDraft(field),
    resolver: zodResolver(ZLibraryFieldDraft),
    mode: "onChange",
  });

  const source = form.watch("source");
  const dataType = form.watch("dataType");
  const { isSubmitting } = form.formState;

  const close = () => {
    setPendingTypeChange(null);
    setOpen(false);
  };

  /**
   * The key writes itself from the name and stops the moment the author edits it — the same rule the
   * contact-attribute dialog uses, and the same `toSafeIdentifier` that decides what a legal key
   * looks like.
   */
  const handleNameChange = (value: string) => {
    const previousAutoKey = toSafeIdentifier(form.getValues("name"));
    const currentKey = form.getValues("key");
    const shouldFollow = currentKey === "" || currentKey === previousAutoKey;

    form.setValue("name", value, { shouldValidate: true, shouldDirty: true });
    if (!isEdit && shouldFollow) {
      form.setValue("key", toSafeIdentifier(value), { shouldValidate: true, shouldDirty: true });
    }
  };

  const handleSourceChange = (value: string) => {
    const nextSource = ZEmbeddedDataSource.parse(value);
    form.setValue("source", nextSource, { shouldValidate: true, shouldDirty: true });
    handleDataTypeChange(narrowDataTypeToSource(form.getValues("dataType"), nextSource));
    if (!isLockableSource(nextSource)) {
      form.setValue("locked", false, { shouldValidate: true, shouldDirty: true });
    }
  };

  /**
   * Retyping clears the default. A number typed under `string` is not the same value under `number`,
   * and keeping it would leave the form invalid with an error the author did not cause.
   */
  const handleDataTypeChange = (nextDataType: TEmbeddedDataType) => {
    const changed = nextDataType !== form.getValues("dataType");
    form.setValue("dataType", nextDataType, { shouldValidate: true, shouldDirty: true });
    if (changed) form.setValue("defaultValue", "", { shouldValidate: true, shouldDirty: true });
  };

  const submitWrite = async (
    draft: TLibraryFieldDraft,
    acknowledgeExistingResponses?: boolean
  ): Promise<void> => {
    const candidate = toCandidateRow(draft);
    const response = isEdit
      ? await updateSharedEmbeddedDataAction({
          id: field.id,
          name: candidate.name,
          description: candidate.description,
          dataType: candidate.dataType,
          defaultValue: candidate.defaultValue,
          locked: candidate.locked,
          acknowledgeExistingResponses,
        })
      : await createSharedEmbeddedDataAction({
          workspaceId,
          key: candidate.key,
          name: candidate.name,
          description: candidate.description,
          source: candidate.source,
          dataType: candidate.dataType,
          defaultValue: candidate.defaultValue,
          locked: candidate.locked,
        });

    if (!response?.data) {
      toast.error(getFormattedErrorMessage(response) || t("common.something_went_wrong_please_try_again"));
      return;
    }

    handleWriteResult(response.data, draft);
  };

  const handleWriteResult = (result: TSharedEmbeddedDataWriteResult, draft: TLibraryFieldDraft): void => {
    if (result.status === "keyConflict") {
      const message = t("workspace.embedded_data.key_already_exists");
      // An update never sends a key, so this only reaches the create dialog — where the control the
      // author has to change is on screen. The toast is the fallback for the branch that cannot
      // happen, so it can never fail silently.
      if (isEdit) toast.error(message);
      else form.setError("key", { message });
      return;
    }

    // On an update this is the dataType guard: the field's surveys already hold responses that were
    // read as the old type. Nothing is destroyed by going ahead, so the author is shown what it
    // affects and the same edit is re-sent with the acknowledgement.
    if (result.status === "inUse") {
      setPendingTypeChange({ draft, surveyCount: result.usage.length });
      return;
    }

    toast.success(
      isEdit
        ? t("workspace.embedded_data.field_updated", { name: result.field.name })
        : t("workspace.embedded_data.field_created", { name: result.field.name })
    );
    close();
    onSaved();
  };

  const onSubmit: SubmitHandler<TLibraryFieldDraft> = async (draft) => {
    await submitWrite(draft);
  };

  const confirmTypeChange = async () => {
    if (!pendingTypeChange) return;

    setIsConfirming(true);
    try {
      // Left open until the write answers: a success closes the whole dialog through `close()`, and
      // a failure leaves the confirmation where it was, with its toast.
      await submitWrite(pendingTypeChange.draft, true);
    } finally {
      setIsConfirming(false);
    }
  };

  const renderDefaultValueControl = (value: string, onChange: (next: string) => void) => {
    if (dataType === "boolean") {
      return (
        <Select
          value={value === "" ? NO_DEFAULT_VALUE : value}
          onValueChange={(next) => onChange(next === NO_DEFAULT_VALUE ? "" : next)}>
          <SelectTrigger className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={NO_DEFAULT_VALUE}>{t("workspace.embedded_data.no_default")}</SelectItem>
            <SelectItem value="true">{t("workspace.embedded_data.value_true")}</SelectItem>
            <SelectItem value="false">{t("workspace.embedded_data.value_false")}</SelectItem>
          </SelectContent>
        </Select>
      );
    }

    if (dataType === "date") {
      return (
        <DatePicker
          value={parseStoredDay(value)}
          locale={locale}
          triggerClassName="w-full"
          onChange={(date) => onChange(formatLocalDay(date))}
          onClear={() => onChange("")}
        />
      );
    }

    return (
      <Input
        type={dataType === "number" ? "number" : "text"}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    );
  };

  return (
    <>
      <Dialog
        // Hidden rather than unmounted while the type change is confirmed: one dialog on screen at a
        // time, and cancelling the confirmation returns the author to the form exactly as they left it.
        open={open && pendingTypeChange === null}
        onOpenChange={(next) => {
          if (!next) close();
        }}>
        <DialogContent width="narrow">
          <DialogHeader>
            <DialogTitle>
              {isEdit
                ? t("workspace.embedded_data.edit_library_field")
                : t("workspace.embedded_data.new_library_field")}
            </DialogTitle>
            <DialogDescription>
              {isEdit
                ? t("workspace.embedded_data.edit_library_field_description")
                : t("workspace.embedded_data.new_library_field_description")}
            </DialogDescription>
          </DialogHeader>

          <FormProvider {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)}>
              <DialogBody>
                <div className="flex flex-col gap-4">
                  <FormField
                    control={form.control}
                    name="name"
                    render={({ field: nameField }) => (
                      <FormItem>
                        <FormLabel>{t("common.name")}</FormLabel>
                        <FormControl>
                          <Input {...nameField} onChange={(event) => handleNameChange(event.target.value)} />
                        </FormControl>
                        <FormError />
                      </FormItem>
                    )}
                  />

                  {isEdit ? (
                    <div className="flex flex-col gap-2">
                      <Label>{t("common.key")}</Label>
                      <code className="text-sm font-medium text-slate-800">{field.key}</code>
                      <p className="text-xs text-slate-500">
                        {t("workspace.embedded_data.key_cannot_be_changed")}
                      </p>
                    </div>
                  ) : (
                    <FormField
                      control={form.control}
                      name="key"
                      render={({ field: keyField }) => (
                        <FormItem>
                          <FormLabel>{t("common.key")}</FormLabel>
                          <FormControl>
                            <Input {...keyField} isInvalid={Boolean(form.formState.errors.key)} />
                          </FormControl>
                          <FormDescription>{t("workspace.embedded_data.key_hint")}</FormDescription>
                          <FormError />
                        </FormItem>
                      )}
                    />
                  )}

                  <FormField
                    control={form.control}
                    name="description"
                    render={({ field: descriptionField }) => (
                      <FormItem>
                        <FormLabel>{`${t("common.description")} (${t("common.optional")})`}</FormLabel>
                        <FormControl>
                          <Input {...descriptionField} />
                        </FormControl>
                        <FormError />
                      </FormItem>
                    )}
                  />

                  {isEdit ? (
                    <div className="flex flex-col gap-2">
                      <Label>{t("workspace.embedded_data.value_source")}</Label>
                      <div className="flex items-center gap-2 text-slate-500">
                        {getSourceIcon(field.source, "size-4")}
                        <Badge text={getSourceLabel(field.source, t)} type="gray" size="tiny" />
                      </div>
                      <p className="text-xs text-slate-500">
                        {t("workspace.embedded_data.source_cannot_be_changed")}
                      </p>
                    </div>
                  ) : (
                    <FormField
                      control={form.control}
                      name="source"
                      render={({ field: sourceField }) => (
                        <FormItem>
                          <FormLabel>{t("workspace.embedded_data.value_source")}</FormLabel>
                          <FormControl>
                            <RadioGroup
                              className="grid-cols-2 gap-3"
                              value={sourceField.value}
                              onValueChange={handleSourceChange}
                              aria-label={t("workspace.embedded_data.value_source")}>
                              {getAuthorableSources().map((authorableSource) => (
                                <label
                                  key={authorableSource}
                                  htmlFor={`embedded-data-source-${authorableSource}`}
                                  className="flex cursor-pointer items-center gap-3 rounded-md border border-slate-200 p-3">
                                  <RadioGroupItem
                                    className="shrink-0"
                                    value={authorableSource}
                                    id={`embedded-data-source-${authorableSource}`}
                                  />
                                  <span className="flex items-center gap-2 text-sm font-medium text-slate-800">
                                    {getSourceIcon(authorableSource, "size-4")}
                                    {getSourceLabel(authorableSource, t)}
                                  </span>
                                </label>
                              ))}
                            </RadioGroup>
                          </FormControl>
                          <FormError />
                        </FormItem>
                      )}
                    />
                  )}

                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="dataType"
                      render={({ field: dataTypeField }) => (
                        <FormItem>
                          <FormLabel>{t("common.type")}</FormLabel>
                          <FormControl>
                            <Select
                              value={dataTypeField.value}
                              onValueChange={(next) => handleDataTypeChange(ZEmbeddedDataType.parse(next))}>
                              <SelectTrigger className="w-full">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {getDataTypesForSource(source).map((option) => (
                                  <SelectItem key={option} value={option}>
                                    {getDataTypeLabel(option, t)}
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
                      control={form.control}
                      name="defaultValue"
                      render={({ field: defaultField }) => (
                        <FormItem>
                          <FormLabel>{t("workspace.embedded_data.default_value")}</FormLabel>
                          <FormControl>
                            {renderDefaultValueControl(defaultField.value, defaultField.onChange)}
                          </FormControl>
                          <FormError />
                        </FormItem>
                      )}
                    />
                  </div>

                  {/* Why the Type list just got shorter. Which types it holds is `ZEmbeddedData`'s
                      answer, read through `getDataTypesForSource` — this only names the source the
                      sentence is about. */}
                  {source === "computed" && (
                    <p className="text-xs text-slate-500">
                      {t("workspace.embedded_data.calculated_type_hint")}
                    </p>
                  )}

                  {isLockableSource(source) && (
                    <FormField
                      control={form.control}
                      name="locked"
                      render={({ field: lockedField }) => (
                        <FormItem>
                          <AdvancedOptionToggle
                            htmlId="embedded-data-locked"
                            isChecked={lockedField.value}
                            onToggle={lockedField.onChange}
                            title={t("workspace.embedded_data.locked")}
                            description={t("workspace.embedded_data.locked_description")}
                            customContainerClass="px-0 py-0"
                          />
                          <FormError />
                        </FormItem>
                      )}
                    />
                  )}
                </div>
              </DialogBody>

              <DialogFooter className="mt-4">
                <Button type="button" variant="secondary" onClick={close}>
                  {t("common.cancel")}
                </Button>
                <Button type="submit" loading={isSubmitting}>
                  {isEdit ? t("common.save") : t("workspace.embedded_data.create_field")}
                </Button>
              </DialogFooter>
            </form>
          </FormProvider>
        </DialogContent>
      </Dialog>

      {pendingTypeChange && field && (
        <ConfirmationModal
          open={true}
          setOpen={(value) => {
            if (value === false) setPendingTypeChange(null);
          }}
          title={t("workspace.embedded_data.type_change_title", {
            name: field.name,
            from: getDataTypeLabel(field.dataType, t),
            to: getDataTypeLabel(pendingTypeChange.draft.dataType, t),
          })}
          description={t("workspace.embedded_data.type_change_subtitle", {
            count: pendingTypeChange.surveyCount,
          })}
          body={t("workspace.embedded_data.type_change_body", {
            to: getDataTypeLabel(pendingTypeChange.draft.dataType, t),
          })}
          buttonText={t("workspace.embedded_data.change_type")}
          // Nothing is destroyed — the collected values stay exactly as they are — so this is the
          // primary button, not the destructive one this modal defaults to.
          buttonVariant="default"
          buttonLoading={isConfirming}
          onConfirm={confirmTypeChange}
        />
      )}
    </>
  );
};
