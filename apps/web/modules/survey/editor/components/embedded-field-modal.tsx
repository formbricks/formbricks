"use client";

import { useTranslation } from "react-i18next";
import { type TEmbeddedDataType } from "@formbricks/types/embedded-data";
import { type TLinkedEmbeddedField } from "@formbricks/types/embedded-data-resolver";
import { EmbeddedFieldForm } from "@/modules/survey/editor/components/embedded-field-form";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/modules/ui/components/dialog";

interface EmbeddedFieldModalProps {
  /** The field being edited. Always a field this survey owns. */
  entry: TLinkedEmbeddedField;
  open: boolean;
  setOpen: (open: boolean) => void;
  /** Ids already spoken for in the survey's namespace: its elements and ending cards. */
  takenIds: string[];
  /** The addresses this survey's other fields occupy. */
  takenStorageKeys: string[];
  /** Every other field's declared name — what makes a repeat a duplicate. */
  otherDeclaredNames: string[];
  otherDisplayNames: string[];
  /** App locale — the date default's picker formats against it. */
  locale: string;
  /** The type this field has as stored, or null when the survey has never saved it. */
  storedDataType: TEmbeddedDataType | null;
  /** How many responses the survey has. Zero means retyping reinterprets nothing. */
  responseCount: number;
  onSubmitField: (entry: TLinkedEmbeddedField) => void;
}

/**
 * Edit a field this survey owns.
 *
 * A dialog of its own, opened from a row's menu, because editing starts from a row rather than from
 * the card's one Add control — the same split the Actions flow makes between "Add action" and the
 * detail dialog a trigger opens. Creating goes through the Add field dialog's create tab, and both
 * render the same {@link EmbeddedFieldForm}.
 */
export const EmbeddedFieldModal = ({
  entry,
  open,
  setOpen,
  takenIds,
  takenStorageKeys,
  otherDeclaredNames,
  otherDisplayNames,
  locale,
  storedDataType,
  responseCount,
  onSubmitField,
}: Readonly<EmbeddedFieldModalProps>) => {
  const { t } = useTranslation();

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) setOpen(false);
      }}>
      <DialogContent width="narrow">
        <DialogHeader>
          <DialogTitle>{t("workspace.embedded_data.edit_survey_field")}</DialogTitle>
          <DialogDescription>{t("workspace.embedded_data.edit_survey_field_description")}</DialogDescription>
        </DialogHeader>

        <DialogBody>
          <EmbeddedFieldForm
            entry={entry}
            takenIds={takenIds}
            takenStorageKeys={takenStorageKeys}
            otherDeclaredNames={otherDeclaredNames}
            otherDisplayNames={otherDisplayNames}
            locale={locale}
            storedDataType={storedDataType}
            responseCount={responseCount}
            onSubmitField={(next) => {
              onSubmitField(next);
              setOpen(false);
            }}
            onCancel={() => setOpen(false)}
          />
        </DialogBody>
      </DialogContent>
    </Dialog>
  );
};
