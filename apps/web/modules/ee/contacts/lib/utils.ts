import { TContactAttributes } from "@formbricks/types/contact-attribute";
import { TContactWithAttributes, TTransformPersonInput } from "@/modules/ee/contacts/types/contact";
import { readAttributeValue } from "./attribute-storage";

export const getContactIdentifier = (contactAttributes: TContactAttributes | null): string => {
  return contactAttributes?.email || contactAttributes?.userId || "";
};

export const transformPrismaContact = (person: TTransformPersonInput): TContactWithAttributes => {
  const attributes = person.attributes.reduce<Record<string, string>>((acc, attr) => {
    acc[attr.attributeKey.key] = readAttributeValue(attr, attr.attributeKey.dataType);
    return acc;
  }, {});

  return {
    id: person.id,
    attributes,
    environmentId: person.environmentId,
    createdAt: new Date(person.createdAt),
    updatedAt: new Date(person.updatedAt),
  };
};
