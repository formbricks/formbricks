"use client";

import { useAutoAnimate } from "@formkit/auto-animate/react";
import * as Collapsible from "@radix-ui/react-collapsible";
import { DatabaseIcon, LibraryBigIcon, PlusIcon } from "lucide-react";
import { type Dispatch, type SetStateAction, useState } from "react";
import toast from "react-hot-toast";
import { useTranslation } from "react-i18next";
import { type TLinkedEmbeddedField, getSurveyEmbeddedFields } from "@formbricks/types/embedded-data-resolver";
import { type TSurveyQuota } from "@formbricks/types/quota";
import { type TSurvey } from "@formbricks/types/surveys/types";
import { cn } from "@/lib/cn";
import type { TSharedEmbeddedData } from "@/modules/embedded-data/types";
import { EmbeddedDataCardRow } from "@/modules/survey/editor/components/embedded-data-card-row";
import { EmbeddedDataLibraryDialog } from "@/modules/survey/editor/components/embedded-data-library-dialog";
import { EmbeddedFieldModal } from "@/modules/survey/editor/components/embedded-field-modal";
import { PromoteEmbeddedFieldDialog } from "@/modules/survey/editor/components/promote-embedded-field-dialog";
import { embeddedFieldKey, embeddedFieldWarnings } from "@/modules/survey/editor/lib/embedded-field-guards";
import {
  type TEmbeddedFieldBlocker,
  findEmbeddedFieldRemovalBlocker,
} from "@/modules/survey/editor/lib/embedded-field-removal";
import {
  type TLinkableSharedField,
  cloneSharedFieldToLocal,
  declaredEmbeddedFieldName,
  isPromotableEmbeddedField,
  mintStorageKey,
  removeEmbeddedField,
  toSharedEntry,
  upsertEmbeddedField,
} from "@/modules/survey/editor/lib/embedded-fields";
import { getElementsFromBlocks } from "@/modules/survey/lib/client-utils";
import { Button } from "@/modules/ui/components/button";
import { ConfirmationModal } from "@/modules/ui/components/confirmation-modal";
import { DeleteDialog } from "@/modules/ui/components/delete-dialog";
import { EmptyState } from "@/modules/ui/components/empty-state";

interface EmbeddedDataCardProps {
  localSurvey: TSurvey;
  setLocalSurvey: Dispatch<SetStateAction<TSurvey>>;
  /**
   * The survey as stored. Two things read it, and neither can use the working copy: promote acts on
   * the row the database holds, and the name guard grandfathers against the names the survey was
   * saved with, exactly as the server does.
   */
  persistedSurvey: TSurvey;
  activeElementId: string | null;
  setActiveElementId: (id: string | null) => void;
  quotas: TSurveyQuota[];
  /** How many responses the survey has. What makes retyping a field a question rather than an edit. */
  responseCount: number;
  workspaceId: string;
  /** App locale — a date default's picker formats against it. */
  locale: string;
}

/** Fixed, unlike the variables card's `Date.now()` id: one card, and the editor opens one at a time. */
const EMBEDDED_DATA_CARD_ID = "embedded-data";

/**
 * **The editor's one Embedded Data card** (ENG-1851), where the Variables and Hidden Fields cards
 * used to be.
 *
 * Those two cards were a UI for the two legacy columns: one could declare a name and a text-or-number
 * value, the other could declare a name and nothing else. A row carries more than either could say —
 * a type, a default, a lock, and whether the workspace owns the definition — so a single list of rows
 * is what the state has looked like since ENG-2628 and what the author now sees.
 *
 * Everything on screen is `localSurvey.embeddedFields`, and every edit goes back through
 * `setLocalSurvey`. Nothing is written until the survey is saved, with two exceptions that are
 * workspace-level rather than survey-level and say so: adding a field to the library and reading the
 * library both talk to the server immediately, because the library is not this survey's to hold.
 *
 * The removal guards are what stop a field being dropped out from under a reference that still names
 * it — decided by `findEmbeddedFieldRemovalBlocker`, which is one cascade for both sources where the
 * two old cards each carried their own copy.
 */
export const EmbeddedDataCard = ({
  localSurvey,
  setLocalSurvey,
  persistedSurvey,
  activeElementId,
  setActiveElementId,
  quotas,
  responseCount,
  workspaceId,
  locale,
}: Readonly<EmbeddedDataCardProps>) => {
  const { t } = useTranslation();
  const [parent] = useAutoAnimate();
  const open = activeElementId === EMBEDDED_DATA_CARD_ID;

  // `{ entry }` rather than a bare entry, so "creating a new field" is distinguishable from "closed".
  const [editing, setEditing] = useState<{ entry: TLinkedEmbeddedField | null } | null>(null);
  const [promoting, setPromoting] = useState<TLinkedEmbeddedField | null>(null);
  const [cloning, setCloning] = useState<TLinkedEmbeddedField | null>(null);
  const [removing, setRemoving] = useState<TLinkedEmbeddedField | null>(null);
  const [isLibraryOpen, setIsLibraryOpen] = useState(false);

  const embeddedFields = getSurveyEmbeddedFields(localSurvey);
  const persistedFields = getSurveyEmbeddedFields(persistedSurvey);
  const libraryHref = `/workspaces/${workspaceId}/settings/workspace/embedded-data`;
  const warnings = embeddedFieldWarnings(embeddedFields);

  const setOpenState = (next: boolean) => {
    setActiveElementId(next ? EMBEDDED_DATA_CARD_ID : null);
  };

  /** Applies a list transform to the working copy, reading the fields off the survey it is given. */
  const updateFields = (transform: (fields: TLinkedEmbeddedField[]) => TLinkedEmbeddedField[]) => {
    setLocalSurvey((previous) => ({
      ...previous,
      embeddedFields: transform(getSurveyEmbeddedFields(previous)),
    }));
  };

  /**
   * Why a field cannot be removed, as a sentence. The branch is decided in `.ts`; the copy lives here
   * because `t()` calls have to be literal for the translation scanner to resolve them.
   */
  const describeBlocker = (blocker: TEmbeddedFieldBlocker, name: string): string => {
    switch (blocker.reason) {
      case "logic":
        return t("workspace.surveys.edit.embedded_field_used_in_logic", {
          name,
          questionIndex: blocker.elementIndex + 1,
        });
      case "recallWelcome":
        return t("workspace.surveys.edit.embedded_field_used_in_recall_welcome", { name });
      case "recallEnding":
        return t("workspace.surveys.edit.embedded_field_used_in_recall_ending", { name });
      case "recall":
        return t("workspace.surveys.edit.embedded_field_used_in_recall", {
          name,
          questionIndex: blocker.elementIndex + 1,
        });
      case "quota":
        return t("workspace.surveys.edit.embedded_field_used_in_quota", {
          name,
          quotaName: blocker.quotaName,
        });
      case "followUp":
        return t("workspace.surveys.edit.embedded_field_used_in_follow_up", { name });
    }
  };

  const requestRemove = (entry: TLinkedEmbeddedField) => {
    const blocker = findEmbeddedFieldRemovalBlocker(localSurvey, quotas, entry);
    if (blocker) {
      toast.error(describeBlocker(blocker, entry.field.name));
      return;
    }

    setRemoving(entry);
  };

  const confirmRemove = () => {
    if (!removing) return;

    updateFields((fields) => removeEmbeddedField(fields, removing.field.source, removing.link.storageKey));
    toast.success(t("workspace.embedded_data.field_removed", { name: removing.field.name }));
    setRemoving(null);
  };

  const requestPromote = (entry: TLinkedEmbeddedField) => {
    // Promote flips the ownership columns of the row as the database holds it, so a field the editor
    // has changed since the last save would be filed under its old definition — and one the survey
    // has never saved has no row to file at all.
    if (!isPromotableEmbeddedField(entry, persistedFields)) {
      toast.error(t("workspace.embedded_data.promote_needs_save"));
      return;
    }

    setPromoting(entry);
  };

  const handlePromoted = (field: TSharedEmbeddedData, entry: TLinkedEmbeddedField) => {
    // The row is shared from here on and the survey's link already points at it, so the entry is
    // replaced from what promote returned rather than patched — including the name and description
    // the library now owns.
    updateFields((fields) => upsertEmbeddedField(fields, toSharedEntry(field, entry.link.storageKey)));
    setPromoting(null);
  };

  const handleLink = (field: TLinkableSharedField) => {
    updateFields((fields) => [...fields, toSharedEntry(field, mintStorageKey(field.source, field.key))]);
    toast.success(t("workspace.embedded_data.field_added", { name: field.name }));
    setIsLibraryOpen(false);
  };

  const confirmClone = () => {
    if (!cloning) return;

    updateFields((fields) => cloneSharedFieldToLocal(fields, cloning.field.source, cloning.link.storageKey));
    setCloning(null);
  };

  const handleSubmitField = (entry: TLinkedEmbeddedField) => {
    const isNew = editing?.entry === null;
    updateFields((fields) => upsertEmbeddedField(fields, entry));
    toast.success(
      isNew
        ? t("workspace.embedded_data.field_added", { name: entry.field.name })
        : t("workspace.embedded_data.field_updated", { name: entry.field.name })
    );
    setEditing(null);
  };

  /**
   * The type a field has **as stored**, or null when the survey has never saved it.
   *
   * Read off the persisted survey rather than the working copy, so retyping and retyping back is not
   * two questions, and a field with no stored row is not a question at all: it has no responses to
   * reinterpret. Addressed on `(source, storageKey)` for the same reason `isFieldAt` is.
   */
  const storedDataTypeOf = (entry: TLinkedEmbeddedField | null) =>
    persistedFields.find(
      (stored) =>
        stored.field.source === entry?.field.source && stored.link.storageKey === entry.link.storageKey
    )?.field.dataType ?? null;

  /** Ids a new name would collide with, beside the survey's other fields. */
  const takenIds = [
    ...getElementsFromBlocks(localSurvey.blocks).map((element) => element.id),
    ...localSurvey.endings.map((ending) => ending.id),
  ];

  const cardActions = (
    <div className="flex flex-wrap items-center gap-2">
      <Button size="sm" type="button" onClick={() => setEditing({ entry: null })}>
        {t("workspace.embedded_data.new_field")}
        <PlusIcon />
      </Button>
      <Button size="sm" type="button" variant="secondary" onClick={() => setIsLibraryOpen(true)}>
        {t("workspace.embedded_data.add_from_library")}
        <LibraryBigIcon />
      </Button>
    </div>
  );

  return (
    <div className={cn(open ? "shadow-lg" : "shadow-md", "group z-10 flex flex-row rounded-lg bg-white")}>
      <div
        className={cn(
          open ? "bg-slate-50" : "bg-white group-hover:bg-slate-50",
          "flex w-10 items-center justify-center rounded-l-lg border-t border-b border-l group-aria-expanded:rounded-bl-none"
        )}>
        <DatabaseIcon className="size-4" />
      </div>
      <Collapsible.Root
        open={open}
        onOpenChange={setOpenState}
        className="flex-1 rounded-r-lg border border-slate-200 transition-all duration-300 ease-in-out">
        <Collapsible.CollapsibleTrigger
          asChild
          className="flex cursor-pointer justify-between rounded-r-lg p-4 hover:bg-slate-50">
          <div data-testid="embedded-data-card-trigger">
            <div className="inline-flex flex-col">
              <p className="text-sm font-semibold">{t("common.embedded_data")}</p>
              <p className="mt-1 text-xs text-slate-500">{t("workspace.embedded_data.card_description")}</p>
            </div>
          </div>
        </Collapsible.CollapsibleTrigger>
        <Collapsible.CollapsibleContent
          className={`flex flex-col px-4 ${open && "pb-6"} overflow-hidden data-[state=closed]:animate-collapsible-up data-[state=open]:animate-collapsible-down`}>
          <div className="flex flex-col gap-3 pt-1" data-testid="embedded-data-card-content">
            <div className="flex flex-col gap-2" ref={parent}>
              {embeddedFields.length > 0 ? (
                embeddedFields.map((entry) => (
                  <EmbeddedDataCardRow
                    key={embeddedFieldKey(entry)}
                    entry={entry}
                    libraryHref={libraryHref}
                    warnings={warnings.get(embeddedFieldKey(entry)) ?? []}
                    onEdit={() => setEditing({ entry })}
                    onPromote={() => requestPromote(entry)}
                    onCloneToLocal={() => setCloning(entry)}
                    onRemove={() => requestRemove(entry)}
                  />
                ))
              ) : (
                <EmptyState variant="simple" text={t("workspace.embedded_data.card_empty_state")} />
              )}
            </div>
            {cardActions}
          </div>
        </Collapsible.CollapsibleContent>
      </Collapsible.Root>

      {editing && (
        <EmbeddedFieldModal
          // Keyed by the row, so opening a different field remounts the form with that field's values.
          key={editing.entry ? embeddedFieldKey(editing.entry) : "new"}
          entry={editing.entry}
          open={true}
          setOpen={(next) => {
            if (!next) setEditing(null);
          }}
          takenIds={takenIds}
          // Matched on the address rather than on object identity: a render between opening the
          // dialog and submitting it rebuilds the list, and comparing references would then count
          // the edited field's own name as a duplicate of itself.
          otherFieldNames={embeddedFields
            .filter((entry) => entry.link.storageKey !== editing.entry?.link.storageKey)
            .map(declaredEmbeddedFieldName)}
          // Same exclusion, same reason: an edit keeps its own address and must not read as taking it.
          takenStorageKeys={embeddedFields
            .filter((entry) => entry.link.storageKey !== editing.entry?.link.storageKey)
            .map(({ link }) => link.storageKey)}
          locale={locale}
          storedDataType={storedDataTypeOf(editing.entry)}
          responseCount={responseCount}
          onSubmitField={handleSubmitField}
        />
      )}

      {isLibraryOpen && (
        <EmbeddedDataLibraryDialog
          workspaceId={workspaceId}
          open={true}
          setOpen={setIsLibraryOpen}
          embeddedFields={embeddedFields}
          persistedFields={persistedFields}
          onLink={handleLink}
        />
      )}

      {promoting && (
        <PromoteEmbeddedFieldDialog
          key={promoting.link.storageKey}
          entry={promoting}
          open={true}
          setOpen={(next) => {
            if (!next) setPromoting(null);
          }}
          onPromoted={(field) => handlePromoted(field, promoting)}
        />
      )}

      {cloning && (
        <ConfirmationModal
          open={true}
          setOpen={(next) => {
            if (next === false) setCloning(null);
          }}
          title={t("workspace.embedded_data.edit_a_copy_confirm_title", { name: cloning.field.name })}
          // Without a description this modal defaults to "This action cannot be undone", which is
          // the opposite of what the comment below says and of what `buttonVariant` is set for.
          description={t("workspace.embedded_data.edit_a_copy_confirm_description")}
          body={t("workspace.embedded_data.edit_a_copy_confirm_body")}
          buttonText={t("workspace.embedded_data.edit_a_copy")}
          // Nothing is destroyed — the library field is untouched and this survey keeps the values it
          // has collected — so this is the primary button, not the destructive one this modal defaults to.
          buttonVariant="default"
          onConfirm={confirmClone}
        />
      )}

      {/* Who owns the definition decides which dialog: unlinking a library field destroys nothing —
          the definition is the workspace's and other surveys keep it — so that half is a
          confirmation, and only a field this survey owns is a deletion. */}
      {removing &&
        (removing.field.key !== null ? (
          <ConfirmationModal
            open={true}
            setOpen={(next) => {
              if (next === false) setRemoving(null);
            }}
            title={t("workspace.embedded_data.unlink_field_title", { name: removing.field.name })}
            description={t("workspace.embedded_data.unlink_field_description")}
            body={t("workspace.embedded_data.unlink_field_body")}
            buttonText={t("common.remove")}
            buttonVariant="default"
            onConfirm={confirmRemove}
          />
        ) : (
          <DeleteDialog
            open={true}
            setOpen={(next) => {
              if (!next) setRemoving(null);
            }}
            deleteWhat={removing.field.name}
            title={t("workspace.embedded_data.remove_field_title", { name: removing.field.name })}
            text={t("workspace.embedded_data.remove_local_field_text")}
            buttonLabel={t("common.remove")}
            onDelete={confirmRemove}
          />
        ))}
    </div>
  );
};
