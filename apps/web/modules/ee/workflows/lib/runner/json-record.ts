import { isPlainRecord } from "@formbricks/types/responses";

/** A stored JSON column read as an object: the value when it is one, else `{}` (null, a list, a scalar). */
export const toJsonRecord = (value: unknown): Record<string, unknown> => (isPlainRecord(value) ? value : {});
