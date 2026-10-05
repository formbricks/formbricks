import { TFunction } from "i18next";
import { TContactAttributeDataType } from "@formbricks/types/contact-attribute-key";
import { DATA_TYPE_ICONS, getDataTypeLabel } from "@/modules/ui/components/data-type-badge/lib/data-types";

/**
 * The icon and the word for an attribute's kind, both drawn from the shared data-type module so a
 * `number` attribute and a `number` Embedded Data field read as the same kind of thing (ENG-1860).
 */

export const getContactAttributeDataTypeIcon = (dataType: TContactAttributeDataType) => {
  const Icon = DATA_TYPE_ICONS[dataType];
  return <Icon className="size-4" />;
};

export const getContactAttributeDataTypeLabel = (dataType: TContactAttributeDataType, t: TFunction): string =>
  getDataTypeLabel(dataType, t);
