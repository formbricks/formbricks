import type { TFunction } from "i18next";
import { Calendar1Icon, HashIcon, type LucideIcon, TagIcon, ToggleLeftIcon } from "lucide-react";

/**
 * How a value's kind is drawn and named, for every surface that lists typed fields.
 *
 * One module because contact attributes and Embedded Data were each drawing their own glyph for the
 * same four kinds — `TagIcon` here, `FileType2Icon` there — so the same `string` field read as two
 * different things depending on which table an author happened to be looking at. The Attributes
 * icons win, because they are the older and more widely seen set.
 *
 * The union is spelled out rather than imported from either domain: `TContactAttributeDataType`
 * (no boolean) and `TEmbeddedDataType` (boolean) are both assignable to it, and neither package has
 * to become a dependency of `modules/ui`.
 */
export type TDataTypeName = "string" | "number" | "boolean" | "date";

/**
 * A map rather than a chain of ternaries, so it stays exhaustive: adding a kind is a compile error
 * here instead of a row that quietly renders with no icon.
 */
export const DATA_TYPE_ICONS: Record<TDataTypeName, LucideIcon> = {
  string: TagIcon,
  number: HashIcon,
  boolean: ToggleLeftIcon,
  date: Calendar1Icon,
};

/**
 * What a kind is called on screen.
 *
 * Every `t()` call takes a literal key: the translation scanner resolves them statically, so a table
 * of key strings would read as unused keys and fail the i18n check.
 */
export const getDataTypeLabel = (dataType: TDataTypeName, t: TFunction): string => {
  switch (dataType) {
    case "number":
      return t("common.number");
    case "boolean":
      return t("workspace.embedded_data.type_boolean");
    case "date":
      return t("common.date");
    case "string":
    default:
      return t("common.text");
  }
};
