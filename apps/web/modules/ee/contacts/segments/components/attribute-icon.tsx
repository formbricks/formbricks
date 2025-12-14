import { CalendarIcon, HashIcon, TagIcon } from "lucide-react";
import { TContactAttributeDataType } from "@formbricks/types/contact-attribute-key";

interface AttributeIconProps {
  dataType?: TContactAttributeDataType;
  className?: string;
}

export const AttributeIcon = ({ dataType, className }: AttributeIconProps) => {
  switch (dataType) {
    case "date":
      return <CalendarIcon className={className} />;
    case "number":
      return <HashIcon className={className} />;
    case "text":
    default:
      return <TagIcon className={className} />;
  }
};
