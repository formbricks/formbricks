import "server-only";

import { TAttributeClass } from "@formbricks/types/attributeClasses";

export const formatAttributeClassDateFields = (attributeClass: TAttributeClass): TAttributeClass => {
  if (typeof attributeClass.createdAt === "string") {
    attributeClass.createdAt = new Date(attributeClass.createdAt);
  }
  if (typeof attributeClass.updatedAt === "string") {
    attributeClass.updatedAt = new Date(attributeClass.updatedAt);
  }

  return attributeClass;
};
