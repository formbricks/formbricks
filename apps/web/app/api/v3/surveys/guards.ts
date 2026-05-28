import type { TI18nString } from "@formbricks/types/i18n";

export function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function isInternalI18nString(value: unknown): value is TI18nString {
  return (
    isPlainObject(value) &&
    typeof value.default === "string" &&
    Object.values(value).every((entry) => typeof entry === "string")
  );
}
