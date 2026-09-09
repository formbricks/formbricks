import {
  RESERVED_FIELD_CATALOG,
  type TReservedFieldPrivacy,
  redactUrlQuery,
} from "@formbricks/types/embedded-data-resolver";
import { type TResponseMeta } from "@formbricks/types/responses";

/**
 * `privacy` by reserved field name, so the policy below is a lookup rather than a list it has to keep
 * in sync with the catalog. Built once at module load; the catalog is a module-level constant.
 */
const PRIVACY_BY_FIELD_NAME = new Map<string, TReservedFieldPrivacy>(
  RESERVED_FIELD_CATALOG.map((entry) => [entry.name, entry.privacy])
);

/**
 * The meta keys that carry more than one reserved field, mapped from **sub-key in `meta`** to
 * **catalog field name**.
 *
 * Declared rather than derived, because for these two the spellings genuinely differ: `meta.userAgent`
 * is one object but three catalog entries, and the sub-key is `device` while the field is called
 * `deviceType`. Every other reserved field sits at a top-level `meta` key named exactly like its
 * catalog entry, and is therefore matched by name with nothing to declare — which is what lets a
 * newly added catalog entry take effect here with no change to this file.
 */
const COMPOSITE_META_KEYS: Record<string, Record<string, string> | undefined> = {
  userAgent: { browser: "browser", os: "os", device: "deviceType" },
};

/** A value survived the policy, or it did not. `undefined` is a legal *kept* value, hence the flag. */
type TPrivacyOutcome = { readonly dropped: true } | { readonly dropped: false; readonly value: unknown };

/**
 * Applies one field's declared `privacy` to one value.
 *
 * A field the catalog does not name is **kept**. Reserved fields are exactly the catalog's entries, so
 * an unnamed `meta` key is not a reserved field at all and this policy has no opinion on it; silently
 * discarding it would destroy data nobody classified. The catalog itself makes `privacy` a required
 * property, so a reserved field cannot be added without the decision being made there.
 */
const applyPrivacy = (fieldName: string | undefined, value: unknown): TPrivacyOutcome => {
  const privacy = fieldName === undefined ? undefined : PRIVACY_BY_FIELD_NAME.get(fieldName);

  if (privacy === "drop") {
    return { dropped: true };
  }

  if (privacy === "redactQuery" && typeof value === "string") {
    return { dropped: false, value: redactUrlQuery(value) };
  }

  return { dropped: false, value };
};

/**
 * Applies the policy to the sub-keys of a composite meta value, returning `undefined` when nothing
 * survives so the caller can remove the key outright rather than store an empty object.
 */
const anonymizeCompositeValue = (
  value: unknown,
  subKeyToFieldName: Record<string, string>
): Record<string, unknown> | undefined => {
  if (typeof value !== "object" || value === null) {
    return undefined;
  }

  const survivors: Record<string, unknown> = {};
  for (const [subKey, subValue] of Object.entries(value)) {
    const outcome = applyPrivacy(subKeyToFieldName[subKey], subValue);
    if (!outcome.dropped) {
      survivors[subKey] = outcome.value;
    }
  }

  return Object.keys(survivors).length > 0 ? survivors : undefined;
};

/**
 * Suppresses the privacy-sensitive reserved fields on a response's `meta` **at ingest**, per the
 * survey's "Anonymize responses" toggle.
 *
 * Pure: the argument is never mutated. With the toggle off the very same object comes back, so a
 * survey that has not opted in is byte-for-byte unaffected by this function existing.
 *
 * The per-field decision comes from `RESERVED_FIELD_CATALOG`'s `privacy` property, never from a list
 * kept here — a new `drop` entry in the catalog is suppressed by this function with no change to this
 * file, and a reviewer changing a field's classification does not have to find a second place that
 * agrees with it.
 *
 * A dropped key is **removed**, not blanked. That is what makes the field resolve as *unset* rather
 * than as an empty string, so a recall token falls back to its `fallback:` text.
 *
 * This is capture-time suppression, deliberately: responses already stored keep whatever they were
 * captured with, and turning the toggle back off resumes capture from that moment. There is no
 * read-time filtering anywhere.
 */
export const applyAnonymizePolicy = <TMeta extends TResponseMeta | undefined>(
  meta: TMeta,
  isAnonymizeEnabled: boolean
): TMeta => {
  if (!isAnonymizeEnabled || !meta) {
    return meta;
  }

  const anonymized: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(meta)) {
    const subKeyToFieldName = COMPOSITE_META_KEYS[key];

    if (subKeyToFieldName) {
      const survivors = anonymizeCompositeValue(value, subKeyToFieldName);
      if (survivors) {
        anonymized[key] = survivors;
      }
      continue;
    }

    const outcome = applyPrivacy(key, value);
    if (!outcome.dropped) {
      anonymized[key] = outcome.value;
    }
  }

  return anonymized as TMeta;
};
