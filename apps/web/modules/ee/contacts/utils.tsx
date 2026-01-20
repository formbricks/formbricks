import { TFunction } from "i18next";
import { Calendar1Icon, HashIcon, TagIcon } from "lucide-react";
import { TContactAttributeDataType } from "@formbricks/types/contact-attribute-key";

export const getContactAttributeDataTypeIcon = (dataType: TContactAttributeDataType) => {
  switch (dataType) {
    case "date":
      return <Calendar1Icon className="h-4 w-4" />;
    case "number":
      return <HashIcon className="h-4 w-4" />;
    case "string":
    default:
      return <TagIcon className="h-4 w-4" />;
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
