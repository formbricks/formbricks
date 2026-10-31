import type {
  TEmbeddedDataUsageItem,
  TSharedEmbeddedData,
  TSharedEmbeddedDataListItem,
} from "@/modules/embedded-data/types";

/**
 * A library field as the API answers with it: the definition, with ISO timestamps. The workspace is the
 * one the caller asked about, and `surveyId` is always null for a library field, so neither is repeated.
 */
export type TEmbeddedDataResource = Omit<
  TSharedEmbeddedData,
  "createdAt" | "updatedAt" | "workspaceId" | "surveyId"
> & {
  createdAt: string;
  updatedAt: string;
};

/** A library row as the settings page lists it: the definition plus how many surveys link it. */
export type TEmbeddedDataListItemResource = TEmbeddedDataResource & { surveyCount: number };

export type TEmbeddedDataUsageResource = TEmbeddedDataUsageItem;

/**
 * Why a write was refused with a 409, in the problem's `details`: a key another field already holds
 * (`existingId` is that field, set only by promote), or surveys that depend on the field as it is.
 */
export type TEmbeddedDataConflictDetails =
  | { reason: "key_conflict"; existingId: string | null }
  | { reason: "in_use"; usage: TEmbeddedDataUsageItem[] };

export const serializeEmbeddedData = (field: TSharedEmbeddedData): TEmbeddedDataResource => ({
  id: field.id,
  key: field.key,
  name: field.name,
  description: field.description,
  source: field.source,
  dataType: field.dataType,
  defaultValue: field.defaultValue,
  locked: field.locked,
  createdAt: field.createdAt.toISOString(),
  updatedAt: field.updatedAt.toISOString(),
});

export const serializeEmbeddedDataListItem = (
  field: TSharedEmbeddedDataListItem
): TEmbeddedDataListItemResource => ({ ...serializeEmbeddedData(field), surveyCount: field.surveyCount });
