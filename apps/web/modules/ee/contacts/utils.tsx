import { TFunction } from "i18next";
import { Calendar1Icon, HashIcon, TagIcon } from "lucide-react";
import { TContactAttributeDataType } from "@formbricks/types/contact-attribute-key";

export const getContactAttributeDataTypeIcon = (dataType: TContactAttributeDataType) => {
  switch (dataType) {
    case "date":
      return <Calendar1Icon className="size-4" />;
    case "number":
      return <HashIcon className="size-4" />;
    case "string":
    default:
      return <TagIcon className="size-4" />;
  }
};

export const getContactAttributeDataTypeLabel = (
  dataType: TContactAttributeDataType,
  t: TFunction
): string => {
  switch (dataType) {
    case "date":
      return t("common.date");
    case "number":
      return t("common.number");
    case "string":
    default:
      return t("common.text");
  }
};
