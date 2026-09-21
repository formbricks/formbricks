"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { type SubmitHandler, useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import {
  type TEmbeddedDataType,
  ZEmbeddedDataSource,
  ZEmbeddedDataType,
} from "@formbricks/types/embedded-data";
import { type TLinkedEmbeddedField } from "@formbricks/types/embedded-data-resolver";
import { TValidateIdErrorCode } from "@formbricks/types/surveys/validation";
import { DefaultValueInput } from "@/modules/embedded-data/components/default-value-input";
import {
  getDataTypeLabel,
  getSourceIcon,
  getSourceLabel,
} from "@/modules/embedded-data/settings/components/field-labels";
import { FieldSourceIndicator } from "@/modules/embedded-data/settings/components/field-status";
import {
  getAuthorableSources,
  getDataTypesForSource,
  isLockableSource,
  narrowDataTypeToSource,
} from "@/modules/embedded-data/settings/lib/library-field";
import {
  type TEmbeddedFieldDraft,
  ZEmbeddedFieldDraft,
  toEmbeddedFieldDraft,
  toLocalEmbeddedField,
} from "@/modules/survey/editor/lib/embedded-field-draft";
import { needsTypeChangeConfirm } from "@/modules/survey/editor/lib/embedded-field-guards";
import { mintFreeStorageKey, validateEmbeddedFieldName } from "@/modules/survey/editor/lib/embedded-fields";
import { getValidateIdErrorMessage } from "@/modules/survey/editor/lib/validation";
import { AdvancedOptionToggle } from "@/modules/ui/components/advanced-option-toggle";
import { Button } from "@/modules/ui/components/button";
import { ConfirmationModal } from "@/modules/ui/components/confirmation-modal";
import {
  FormControl,
  FormDescription,
  FormError,
  FormField,
  FormItem,
  FormLabel,
  FormProvider,
} from "@/modules/ui/components/form";
import { IdBadge } from "@/modules/ui/components/id-badge";
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

interface EmbeddedFieldFormProps {
  /** The field being edited, or null when this is the create form. Always a field this survey owns. */
  entry: TLinkedEmbeddedField | null;
  /** Ids already spoken for in the survey's namespace: its elements and ending cards. */
  takenIds: string[];
  /**
   * The addresses this survey's other fields occupy. A passed-in field is addressed by its name, so
   * a new one can be given an address another field already holds; see `mintFreeStorageKey`.
   */
  takenStorageKeys: string[];
  /** Every other field's declared name — what makes a repeat a duplicate. */
  otherFieldNames: string[];
  /** App locale — the date default's picker formats against it. */
  locale: string;
  /** The type this field has as stored, or null when the survey has never saved it. */
  storedDataType: TEmbeddedDataType | null;
  /** How many responses the survey has. Zero means retyping reinterprets nothing. */
  responseCount: number;
  onSubmitField: (entry: TLinkedEmbeddedField) => void;
  onCancel: () => void;
}

/**
 * The form behind both ways of declaring a field **this survey owns** — the create tab of the Add
 * field dialog, and the edit dialog a row's menu opens.
 *
 * One component because the two differ only in what is fixed, and because the Actions flow they now
 * mirror puts its create form inside a tab while editing keeps a dialog of its own: sharing the form
 * is what stops the two drifting into different validation.
 *
 * `source` is set once: a field's address follows it (a URL parameter for a passed-in field, a recall
 * id for a calculated one), so flipping it would point the survey's stored responses at a key they
 * were never written under. Edit renders it as prose beside the address rather than as a control the
 * author keeps trying to use.
 *
 * **Two validators, neither of them written here.** The row rules — locking only a passed-in field, a
 * calculated field being text or number, a default that agrees with its type — are `ZEmbeddedData`'s,
 * reached through `ZEmbeddedFieldDraft`. The name's own rules — reserved spellings, the identifier
 * charset, duplicates against questions, endings and the survey's other fields — are `validateId`'s,
 * the same call the server's declared-field guard makes, run at submit because it needs the survey.
 */
export const EmbeddedFieldForm = ({
  entry,
  takenIds,
  takenStorageKeys,
  otherFieldNames,
  locale,
  storedDataType,
  responseCount,
  onSubmitField,
  onCancel,
}: Readonly<EmbeddedFieldFormProps>) => {
  const { t } = useTranslation();
  const isEdit = entry !== null;
  // The edit the author has asked for, held back until they answer the retyping question.
  const [pendingTypeChange, setPendingTypeChange] = useState<TLinkedEmbeddedField | null>(null);

  const form = useForm<TEmbeddedFieldDraft>({
    defaultValues: toEmbeddedFieldDraft(entry),
    resolver: zodResolver(ZEmbeddedFieldDraft),
    mode: "onChange",
  });

  const source = form.watch("source");
  const dataType = form.watch("dataType");
  const { isSubmitting } = form.formState;

  const handleSourceChange = (value: string) => {
    const nextSource = ZEmbeddedDataSource.parse(value);
    form.setValue("source", nextSource, { shouldValidate: true, shouldDirty: true });
    handleDataTypeChange(narrowDataTypeToSource(form.getValues("dataType"), nextSource));
    if (!isLockableSource(nextSource)) {
      form.setValue("locked", false, { shouldValidate: true, shouldDirty: true });
    }
  };

  /**
   * Retyping clears the default. A number typed under `Text` is not the same value under `Number`,
   * and keeping it would leave the form invalid with an error the author did not cause.
   */
  const handleDataTypeChange = (nextDataType: TEmbeddedDataType) => {
    const changed = nextDataType !== form.getValues("dataType");
    form.setValue("dataType", nextDataType, { shouldValidate: true, shouldDirty: true });
    if (changed) form.setValue("defaultValue", "", { shouldValidate: true, shouldDirty: true });
  };

  const onSubmit: SubmitHandler<TEmbeddedFieldDraft> = (draft) => {
    const nameError = validateEmbeddedFieldName({
      name: draft.name,
      takenIds,
      otherFieldNames,
      previousName: entry?.field.name ?? null,
    });

    if (nameError) {
      // A name already spoken for is answered in this card's own words (ENG-3266). The shared
      // message names the namespaces it searched — "questions, hidden fields, or variables" — which
      // are the two concepts this card replaced, so the one refusal an author meets routinely was
      // the one sentence still speaking the vocabulary the merged card removed.
      //
      // Its own sentence rather than the address one below: `validateEmbeddedFieldName` refuses a
      // name that collides with an element or an ending card as well as with another field, and only
      // the last of those is a field holding the address. Saying so for a question id would send the
      // author looking for a field that does not exist.
      //
      // Every other code keeps the shared message, named by source: the two halves of the card still
      // occupy the two namespaces recall and logic address fields through, and an empty or malformed
      // name is refused in terms of the one that refused it.
      form.setError("name", {
        message:
          nameError.code === TValidateIdErrorCode.Duplicate
            ? t("workspace.embedded_data.survey_field_name_taken")
            : getValidateIdErrorMessage(
                nameError,
                draft.source === "computed" ? "variable" : "hiddenField",
                t
              ),
      });
      return;
    }

    // An edit keeps the address its responses are already stored under — it is read-only for the
    // same reason the library's key is. Only a new field mints one, and only a new one can collide.
    const storageKey =
      entry?.link.storageKey ?? mintFreeStorageKey(draft.source, draft.name, takenStorageKeys);

    if (storageKey === null) {
      form.setError("name", { message: t("workspace.embedded_data.survey_field_address_taken") });
      return;
    }

    const next = toLocalEmbeddedField(draft, { storageKey, id: entry?.field.id });

    // Retyping a field the survey already has responses for is the one edit that changes how values
    // already collected are read back, so it is asked about rather than applied.
    if (needsTypeChangeConfirm({ nextDataType: draft.dataType, storedDataType, responseCount })) {
      setPendingTypeChange(next);
      return;
    }

    onSubmitField(next);
  };

  return (
    <>
      <FormProvider {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} aria-label="embedded-field-form">
          <div className="flex flex-col gap-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field: nameField }) => (
                <FormItem>
                  <FormLabel>{t("common.name")}</FormLabel>
                  <FormControl>
                    <Input
                      {...nameField}
                      id="embedded-field-name"
                      autoFocus
                      isInvalid={Boolean(form.formState.errors.name)}
                    />
                  </FormControl>
                  <FormDescription>{t("workspace.embedded_data.survey_field_name_hint")}</FormDescription>
                  <FormError />
                </FormItem>
              )}
            />

            {isEdit ? (
              <div className="flex flex-col gap-2">
                <Label>{t("workspace.embedded_data.value_source")}</Label>
                <div className="flex items-center gap-2">
                  <FieldSourceIndicator source={entry.field.source} />
                  <IdBadge id={entry.link.storageKey} showCopyIconOnHover={true} />
                </div>
                <p className="text-xs text-slate-500">
                  {t("workspace.embedded_data.survey_field_address_fixed")}
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
                            htmlFor={`embedded-field-source-${authorableSource}`}
                            className="flex cursor-pointer items-center gap-3 rounded-md border border-slate-200 p-3">
                            <RadioGroupItem
                              className="shrink-0"
                              value={authorableSource}
                              id={`embedded-field-source-${authorableSource}`}
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
                        <SelectTrigger id="embedded-field-type" className="w-full">
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
                      <DefaultValueInput
                        dataType={dataType}
                        id="embedded-field-default"
                        value={defaultField.value}
                        onChange={defaultField.onChange}
                        locale={locale}
                      />
                    </FormControl>
                    <FormError />
                  </FormItem>
                )}
              />
            </div>

            {/* Why the Type list is shorter for a calculated field. Which types it holds is
              `ZEmbeddedData`'s answer, read through `getDataTypesForSource` — this only names
              the source the sentence is about. */}
            {source === "computed" && (
              <p className="text-xs text-slate-500">{t("workspace.embedded_data.calculated_type_hint")}</p>
            )}

            {isLockableSource(source) && (
              <FormField
                control={form.control}
                name="locked"
                render={({ field: lockedField }) => (
                  <FormItem>
                    <AdvancedOptionToggle
                      htmlId="embedded-field-locked"
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

          {/* Sticky rather than a `DialogFooter`, because this form is rendered inside a tab as well
              as inside a dialog of its own — the same shape the Add action dialog's create tab uses. */}
          <div className="sticky bottom-0 z-10 flex justify-end gap-x-2 bg-white pt-4">
            <Button type="button" variant="secondary" onClick={onCancel}>
              {t("common.cancel")}
            </Button>
            <Button type="submit" loading={isSubmitting}>
              {isEdit ? t("common.save") : t("common.add")}
            </Button>
          </div>
        </form>
      </FormProvider>

      {/* `storedDataType` is what the collected responses were read as, and the only type the
          sentence can honestly name — the working copy may already have been retyped once in this
          session. Non-null whenever this renders, since that is what put the edit here. */}
      {pendingTypeChange && entry && storedDataType && (
        <ConfirmationModal
          open={true}
          setOpen={(value) => {
            if (value === false) setPendingTypeChange(null);
          }}
          title={t("workspace.embedded_data.type_change_title", {
            name: entry.field.name,
            from: getDataTypeLabel(storedDataType, t),
            to: getDataTypeLabel(pendingTypeChange.field.dataType, t),
          })}
          description={t("workspace.embedded_data.type_change_responses_subtitle", {
            count: responseCount,
          })}
          body={t("workspace.embedded_data.type_change_body", {
            to: getDataTypeLabel(pendingTypeChange.field.dataType, t),
          })}
          buttonText={t("workspace.embedded_data.change_type")}
          // Nothing is destroyed — the collected values stay exactly as they are — so this is the
          // primary button, not the destructive one this modal defaults to.
          buttonVariant="default"
          onConfirm={() => onSubmitField(pendingTypeChange)}
        />
      )}
    </>
  );
};
