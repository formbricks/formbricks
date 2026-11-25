import type { TFunction } from "i18next";
import { getFieldById, getTranslatedDimensionValueLabel } from "@/modules/ee/analysis/lib/schema-definition";

export const BOOLEAN_DIMENSION_VALUES: readonly string[] = ["true", "false"];

export function getChartDimensionValueLabel(
  dimensionId: string,
  value: unknown,
  t: TFunction
): string | undefined {
  const token = typeof value === "boolean" ? String(value) : value;
  if ((token === "true" || token === "false") && getFieldById(dimensionId)?.type === "boolean") {
    return token === "true" ? t("common.true") : t("common.false");
  }
  return getTranslatedDimensionValueLabel(dimensionId, value, t);
}
