"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRef, useState } from "react";
import { type SubmitHandler, useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import {
  type TEmbeddedDataType,
  ZEmbeddedDataSource,
  ZEmbeddedDataType,
} from "@formbricks/types/embedded-data";
import { type TLinkedEmbeddedField } from "@formbricks/types/embedded-data-resolver";
import { toSafeIdentifier } from "@formbricks/types/safe-identifier";
import { DefaultValueInput } from "@/modules/embedded-data/components/default-value-input";
import { FieldSourceIcon } from "@/modules/embedded-data/settings/components/field-source-icon";
import { FieldSourceIndicator } from "@/modules/embedded-data/settings/components/field-status";
import { getDataTypeLabel, getSourceLabel } from "@/modules/embedded-data/settings/lib/field-labels";
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
import {
  declaredEmbeddedFieldName,
  getEmbeddedFieldErrorMessage,
  isEmbeddedFieldNameTaken,
  mintStorageKey,
  validateEmbeddedFieldDeclaredName,
} from "@/modules/survey/editor/lib/embedded-fields";
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
   * The addresses this survey's other fields occupy. The survey would otherwise only fail at the
   * save, on `@@unique([surveyId, storageKey])`, as a Prisma violation with no field to point at.
   */
  takenStorageKeys: string[];
  /**
   * Every other field's **declared** name — its address for a passed-in field, its name for a
   * calculated one. This is the namespace recall and logic address, so it is what makes a repeat a
   * duplicate.
   */
  otherDeclaredNames: string[];
  /**
   * Every other field's **display** name, which is a different set: a passed-in field's label is
   * free text and never enters the namespace above.
   */
  otherDisplayNames: string[];
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
  otherDeclaredNames,
  otherDisplayNames,
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

  /**
   * Narrowing on a source switch is reversible, unlike the author retyping the field themselves.
   *
   * `narrowDataTypeToSource` keeps the current type whenever the new source still allows it, so only
   * the narrowing case moves anything — and that case is the one the author did not ask for. Without
   * the snapshot, Passed-in/Date/a default -> Calculated -> back to Passed-in left a Text field with
   * no default: the type was narrowed to `string` on the way out, and coming back `string` is still
   * allowed, so nothing restored it.
   */
  const narrowedAway = useRef<{ dataType: TEmbeddedDataType; defaultValue: string } | null>(null);

  /**
   * The ID follows the name while the author has not taken it over, the same way the library form's
   * key does — so the common case is one input, and the address is still something they can see and
   * correct before it is fixed forever.
   *
   * `shouldFollow` compares against what the *previous* name would have produced, not against empty:
   * that is what tells an untouched auto-generated value apart from one the author typed, so their
   * own ID survives a later edit to the name. Create only — an existing field's address is read-only.
   */
  /**
   * Whether the Key is still the one this form derived, rather than one the author typed over it.
   * Compared against what the *current* name would produce, which is what tells an untouched
   * auto-generated value apart from a deliberate one.
   */
  const keyStillFollowsName = (): boolean => {
    const currentKey = form.getValues("storageKey");
    return currentKey === "" || currentKey === toSafeIdentifier(form.getValues("name"));
  };

  const handleNameChange = (value: string) => {
    const shouldFollow = keyStillFollowsName();

    form.setValue("name", value, { shouldValidate: true, shouldDirty: true });
    // Only a passed-in field has an address the author writes. A calculated one mints a cuid at
    // submit, so there is no ID input for this to fill.
    if (!isEdit && shouldFollow && form.getValues("source") === "ingested") {
      form.setValue("storageKey", toSafeIdentifier(value), { shouldValidate: true, shouldDirty: true });
    }
  };

  const handleSourceChange = (value: string) => {
    const nextSource = ZEmbeddedDataSource.parse(value);
    form.setValue("source", nextSource, { shouldValidate: true, shouldDirty: true });

    const current = form.getValues("dataType");
    const restored = narrowedAway.current;
    const wanted =
      restored !== null && getDataTypesForSource(nextSource).includes(restored.dataType)
        ? restored.dataType
        : current;
    const narrowed = narrowDataTypeToSource(wanted, nextSource);

    narrowedAway.current =
      narrowed === wanted ? null : { dataType: wanted, defaultValue: form.getValues("defaultValue") };

    handleDataTypeChange(narrowed);
    if (narrowed === restored?.dataType) {
      form.setValue("defaultValue", restored.defaultValue, { shouldValidate: true, shouldDirty: true });
    }
    if (!isLockableSource(nextSource)) {
      form.setValue("locked", false, { shouldValidate: true, shouldDirty: true });
    }
    // The Key input is only rendered for a passed-in field, so coming back to one has to re-derive
    // what it would have held — otherwise the address stays at whatever the name was when the author
    // last switched away, or empty if they never typed one.
    //
    // Guarded by the same rule the Name change uses: a key the author wrote themselves survives the
    // round trip, because it cannot be changed once the field exists and silently reverting it would
    // cost them the one thing this form fixes forever.
    if (nextSource === "ingested" && !isEdit && keyStillFollowsName()) {
      form.setValue("storageKey", toSafeIdentifier(form.getValues("name")), {
        shouldValidate: true,
        shouldDirty: true,
      });
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
    // Which control holds the declared name follows the source, so the refusal lands on the input the
    // author would have to change — resolved the same way the server's guard resolves it, which is
    // what keeps an inline error and a refused save agreeing.
    //
    // A passed-in field declares its address, so the ID input carries the identifier rules and its
    // Name is free text. A calculated field declares its *name*, so that one control is the ID and is
    // labelled as such; its address is a minted cuid, because the legacy `variables` column it is
    // dual-written to pins `id` to `z.cuid2()`. Giving a calculated field a free display name as well
    // needs `declaredEntryName` to move off the name on both of its payload shapes — see ENG-3383.
    const declaresByAddress = draft.source === "ingested";
    const declaredControl = declaresByAddress ? "storageKey" : "name";
    const declaredName = declaresByAddress ? draft.storageKey : draft.name;

    // An edit keeps the address its responses are already stored under — read-only for the same
    // reason the library's key is, and rendered as a badge rather than an input.
    const storageKey =
      entry?.link.storageKey ??
      (declaresByAddress ? draft.storageKey : mintStorageKey(draft.source, draft.name));

    // Only a passed-in field has a display name free enough to repeat one. A calculated field's name
    // is its declared name, so a repeat is already a duplicate below.
    if (
      declaresByAddress &&
      isEmbeddedFieldNameTaken({ name: draft.name, otherFieldNames: otherDisplayNames })
    ) {
      form.setError("name", { message: t("workspace.embedded_data.survey_field_display_name_taken") });
      return;
    }

    const addressError = validateEmbeddedFieldDeclaredName({
      declaredName,
      takenIds,
      // Both sources judge against the same namespace. A passed-in field's key must dodge the
      // storage keys too: a calculated field's address is a cuid the card displays and offers to
      // copy, so an author can paste one in, and `@@unique([surveyId, storageKey])` would only
      // catch it at the save with no field to point at.
      otherDeclaredNames: declaresByAddress
        ? [...otherDeclaredNames, ...takenStorageKeys]
        : otherDeclaredNames,
      previousDeclaredName: entry === null ? null : declaredEmbeddedFieldName(entry),
    });

    if (addressError) {
      form.setError(declaredControl, {
        message: getEmbeddedFieldErrorMessage(
          addressError,
          declaresByAddress ? t("common.key") : t("common.name"),
          t
        ),
      });
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
                      // `data-testid`, not `id`: an explicit id wins over the one `FormControl`
                      // supplies, and `FormLabel htmlFor` then points at the description below.
                      data-testid="embedded-field-name"
                      autoFocus
                      onChange={(event) => handleNameChange(event.currentTarget.value)}
                      isInvalid={Boolean(form.formState.errors.name)}
                    />
                  </FormControl>
                  <FormDescription>
                    {source === "computed"
                      ? t("workspace.embedded_data.survey_field_computed_name_hint")
                      : t("workspace.embedded_data.survey_field_name_hint")}
                  </FormDescription>
                  <FormError />
                </FormItem>
              )}
            />

            {/* Create only, and only for a passed-in field: that is the one whose address the author
              spells, in the URL or the SDK call. A calculated field is addressed by the recall id its
              tokens already carry, which is minted rather than typed. */}
            {!isEdit && source === "ingested" && (
              <FormField
                control={form.control}
                name="storageKey"
                render={({ field: keyField }) => (
                  <FormItem>
                    <FormLabel>{t("common.key")}</FormLabel>
                    <FormControl>
                      <Input
                        {...keyField}
                        data-testid="embedded-field-key"
                        isInvalid={Boolean(form.formState.errors.storageKey)}
                      />
                    </FormControl>
                    <FormDescription>{t("workspace.embedded_data.survey_field_key_hint")}</FormDescription>
                    <FormError />
                  </FormItem>
                )}
              />
            )}

            {isEdit ? (
              <div className="flex flex-col gap-2">
                <Label>{t("workspace.embedded_data.value_source")}</Label>
                <div className="flex items-center gap-2">
                  <FieldSourceIndicator source={entry.field.source} />
                  <IdBadge id={entry.link.storageKey} />
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
                              <FieldSourceIcon source={authorableSource} className="size-4" />
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

            {/* Why the Type list below is shorter for a calculated field. Which types it holds is
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
                        <SelectTrigger data-testid="embedded-field-type" className="h-10 w-full">
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
                        data-testid="embedded-field-default"
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
          </div>

          {/* Sticky rather than a `DialogFooter`, because this form is rendered inside a tab as well
              as inside a dialog of its own — the same shape the Add action dialog's create tab uses. */}
          <div className="sticky bottom-0 z-10 flex justify-end gap-x-2 bg-white pt-4">
            <Button type="button" variant="secondary" onClick={onCancel}>
              {t("common.cancel")}
            </Button>
            {/* No `loading`: this form writes to `localSurvey` synchronously, so `isSubmitting` is
                never observable and the prop read as double-submit protection that was not there.
                The save itself is the menu bar's. */}
            <Button type="submit">{isEdit ? t("common.save") : t("common.add")}</Button>
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
