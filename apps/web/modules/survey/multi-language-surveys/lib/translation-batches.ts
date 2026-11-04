export interface TranslationBatchField {
  path: string;
  defaultText: string;
  isRichText: boolean;
}

export const AI_TRANSLATION_FIELDS_PER_BATCH = 8;
export const AI_TRANSLATION_SOURCE_CHARS_PER_BATCH = 3000;
export const AI_TRANSLATION_BATCHES_PER_RUN = 50;

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
