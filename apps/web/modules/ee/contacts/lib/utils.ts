import { TContactWithAttributes, TTransformPersonInput } from "@/modules/ee/contacts/types/contact";
import { Prisma } from "@prisma/client";
import { TContactAttributes } from "@formbricks/types/contact-attributes";

export const getContactIdentifier = (personAttributes: TContactAttributes | null): string => {
  return personAttributes?.email?.value ?? personAttributes?.userId?.value ?? "";
};

export const convertPrismaContactAttributes = (
  prismaAttributes: Prisma.ContactAttributeGetPayload<{
    select: { value: true; attributeKey: { select: { key: true; name: true } } };
  }>[]
): TContactAttributes => {
  return prismaAttributes.reduce((acc, attr) => {
    acc[attr.attributeKey.key] = {
      name: attr.attributeKey.name,
      value: attr.value,
    };
    return acc;
  }, {});
};

export const transformPrismaContact = (person: TTransformPersonInput): TContactWithAttributes => {
  const attributes = person.attributes.reduce((acc, attr) => {
    acc[attr.attributeKey.key] = attr.value;
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
