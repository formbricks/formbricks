/**
 * The editor's Embedded Data state, as rows (ENG-2628).
 *
 * `localSurvey.embeddedFields` is what the Variables and Hidden Fields cards now edit, and what
 * every editor reader resolves through — the legacy `variables` / `hiddenFields` columns are
 * forwarded untouched from mount state at the save boundary and re-derived server-side from these
 * rows (`toLegacyEmbeddedFields`). That is what removes the stale-projection problem the editor had
 * while the cards owned the columns: there is one description of a survey's fields in the working
 * copy, so a reader can no longer disagree with the card that just changed it.
 *
 * Every function here is a pure list transform. The cards hold the list on `localSurvey` and hand it
 * back through `setLocalSurvey`, so nothing in this module knows about React or about the survey.
 *
 * **Position is the order the author sees and the order that is stored.** A new field is appended,
 * an edited one keeps its place, and the reconcile writes `order` from this array's index — so the
 * Variables card, the Hidden Fields card, the derived legacy columns and the stored rows all agree
 * without anyone sorting anything.
 */
import { type TEmbeddedDataSource } from "@formbricks/types/embedded-data";
import { type TLinkedEmbeddedField } from "@formbricks/types/embedded-data-resolver";
import { type TSurveyVariable } from "@formbricks/types/surveys/types";

/**
 * Addresses one field the way the reconcile does, on `(source, storageKey)`.
 *
 * A survey's storage keys are unique on their own (`@@unique([surveyId, storageKey])`), so for a
 * well-formed survey the source is redundant. It is matched anyway so that a survey which is not
 * cannot have a variable lookup answered by a hidden field, or the other way round.
 */
const isFieldAt =
  (source: TEmbeddedDataSource, storageKey: string) =>
  (entry: TLinkedEmbeddedField): boolean =>
    entry.field.source === source && entry.link.storageKey === storageKey;

/**
 * One computed field as the `TSurveyVariable` the Variables card's form still speaks.
 *
 * The form, its validation and its inputs are unchanged by ENG-2628 — only where the value comes
 * from is — so the adaptation happens here rather than in the component. The value guard mirrors
 * `toLegacyVariable` exactly: `defaultValue` is a `string | number | boolean | null` while a
 * variable's value must match its declared type, and both sides must fall back to the same thing or
 * a save would round-trip an author's `0` into `""`.
 *
 * Labelled with `field.name`, never `key ?? name` as the derived legacy column is: the card shows a
 * human the field's display name, while the column needs the one spelling that is guaranteed to
 * satisfy `isLegacyVariableName`.
 *
 * The form has two types, so a `date` or `boolean` row shows here as text. That is lossy, which is
 * why it is a one-way trip — see {@link isCardRepresentable}.
 */
export const toCardVariable = ({ field, link }: TLinkedEmbeddedField): TSurveyVariable =>
  field.dataType === "number"
    ? {
        id: link.storageKey,
        name: field.name,
        type: "number",
        value: typeof field.defaultValue === "number" ? field.defaultValue : 0,
      }
    : {
        id: link.storageKey,
        name: field.name,
        type: "text",
        value: typeof field.defaultValue === "string" ? field.defaultValue : "",
      };

/** The survey's computed fields in card order, each as the variable the card's form edits. */
export const toCardVariables = (embeddedFields: readonly TLinkedEmbeddedField[]): TSurveyVariable[] =>
  embeddedFields.filter(({ field }) => field.source === "computed").map(toCardVariable);

/**
 * Whether the card's form can describe this row's type and value without losing them.
 *
 * It offers `text` and `number`, so a `date` or `boolean` computed field round-trips through
 * {@link toCardVariable} as text — and writing that back would retype the row to `string` and, for a
 * boolean, replace its default with `""`. The card submits on blur, so a focus change with no edit
 * at all is enough to trigger it. Nothing in the editor can create such a row today; the V2 panel
 * (ENG-1851) is what gives it a control, and until then the safe answer is to leave its type and
 * value exactly as stored.
 */
const isCardRepresentable = ({ dataType }: TLinkedEmbeddedField["field"]): boolean =>
  dataType === "string" || dataType === "number";

/**
 * The list with one computed field created or updated from the card's form.
 *
 * An existing row is **merged into**, not replaced: `id`, `key` and `locked` have no carrier in the
 * variable form, and dropping them would unlink a shared definition or unlock a locked one on the
 * next save. A new field is local and unlocked, which is the only thing this card can declare.
 *
 * A row the form cannot describe keeps its `dataType` and `defaultValue`; only the name, which the
 * form does carry losslessly for every type, moves.
 */
export const upsertCardVariable = (
  embeddedFields: readonly TLinkedEmbeddedField[],
  variable: TSurveyVariable
): TLinkedEmbeddedField[] => {
  const dataType = variable.type === "number" ? "number" : "string";
  const existingIndex = embeddedFields.findIndex(isFieldAt("computed", variable.id));

  if (existingIndex === -1) {
    return [
      ...embeddedFields,
      {
        field: {
          name: variable.name,
          source: "computed",
          dataType,
          defaultValue: variable.value,
          locked: false,
          key: null,
        },
        link: { storageKey: variable.id },
      },
    ];
  }

  return embeddedFields.map((entry, index) =>
    index === existingIndex
      ? {
          ...entry,
          field: isCardRepresentable(entry.field)
            ? { ...entry.field, name: variable.name, dataType, defaultValue: variable.value }
            : { ...entry.field, name: variable.name },
        }
      : entry
  );
};

/**
 * The list with one ingested field appended.
 *
 * The defaults are the ones `toDesiredEmbeddedFields` gives a hidden field derived from the legacy
 * column — a hidden field is addressed by its name and has no display label separate from it, and
 * typing it or giving it a default is a V2 action. Keeping them identical is what makes the legacy
 * `hiddenFields.fieldIds` this derives back into byte-for-byte what the card used to write.
 */
export const appendIngestedField = (
  embeddedFields: readonly TLinkedEmbeddedField[],
  storageKey: string
): TLinkedEmbeddedField[] => [
  ...embeddedFields,
  {
    field: {
      name: storageKey,
      source: "ingested",
      dataType: "string",
      defaultValue: null,
      locked: false,
      key: null,
    },
    link: { storageKey },
  },
];

/** The list without the addressed field. A key that is not there is not an error — nothing to drop. */
export const removeEmbeddedField = (
  embeddedFields: readonly TLinkedEmbeddedField[],
  source: TEmbeddedDataSource,
  storageKey: string
): TLinkedEmbeddedField[] => embeddedFields.filter((entry) => !isFieldAt(source, storageKey)(entry));
