export interface TranslationBatchField {
  path: string;
  defaultText: string;
  isRichText: boolean;
}

export const AI_TRANSLATION_FIELDS_PER_BATCH = 8;
export const AI_TRANSLATION_SOURCE_CHARS_PER_BATCH = 3000;
export const AI_TRANSLATION_MAX_FIELD_CHARS = 20_000;
export const AI_TRANSLATION_FIELD_TOO_LONG = "ai_translation_field_exceeds_20000_characters";
export const AI_TRANSLATION_MAX_FIELDS_PER_ACTION = 256;
export const AI_TRANSLATION_TOO_MANY_FIELDS = "ai_translation_exceeds_256_fields";
export const AI_TRANSLATION_MODEL_BATCHES_PER_ACTION = 3;
export const AI_TRANSLATION_ACTIONS_PER_RUN = 20;

export const partitionTranslationFieldsByLength = (fields: readonly TranslationBatchField[]) => {
  const eligible: TranslationBatchField[] = [];
  const skipped: TranslationBatchField[] = [];

  for (const field of fields) {
    if (field.defaultText.length <= AI_TRANSLATION_MAX_FIELD_CHARS) {
      eligible.push(field);
    } else {
      skipped.push(field);
    }
  }

  return { eligible, skipped };
};

export const createTranslationBatches = (
  fields: readonly TranslationBatchField[]
): TranslationBatchField[][] => {
  const batches: TranslationBatchField[][] = [];
  let batch: TranslationBatchField[] = [];
  let sourceChars = 0;

  for (const field of fields) {
    if (
      batch.length > 0 &&
      (batch.length === AI_TRANSLATION_FIELDS_PER_BATCH ||
        sourceChars + field.defaultText.length > AI_TRANSLATION_SOURCE_CHARS_PER_BATCH)
    ) {
      batches.push(batch);
      batch = [];
      sourceChars = 0;
    }

    batch.push(field);
    sourceChars += field.defaultText.length;
  }

  if (batch.length > 0) batches.push(batch);

  return batches;
};

export const createTranslationActionBatches = (
  fields: readonly TranslationBatchField[]
): TranslationBatchField[][] => {
  const modelBatches = createTranslationBatches(fields);
  const actionBatches: TranslationBatchField[][] = [];

  for (let index = 0; index < modelBatches.length; index += AI_TRANSLATION_MODEL_BATCHES_PER_ACTION) {
    actionBatches.push(modelBatches.slice(index, index + AI_TRANSLATION_MODEL_BATCHES_PER_ACTION).flat());
  }

  return actionBatches;
};
