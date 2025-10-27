import { Prisma } from "@prisma/client";
import { TContactAttributes } from "@formbricks/types/contact-attribute";
import { TResponseInput } from "@formbricks/types/responses";

export const buildPrismaResponseData = (
  responseInput: TResponseInput,
  contact: { id: string; attributes: TContactAttributes } | null,
  ttc: Record<string, number>
): Prisma.ResponseCreateInput => {
  const {
    surveyId,
    displayId,
    finished,
    data,
    language,
    meta,
    singleUseId,
    variables,
    createdAt,
    updatedAt,
  } = responseInput;

  return {
    survey: {
      connect: {
        id: surveyId,
      },
    },
    display: displayId ? { connect: { id: displayId } } : undefined,
    finished: finished,
    data: data,
    language: language,
    ...(contact?.id && {
      contact: {
        connect: {
          id: contact.id,
        },
      },
      contactAttributes: contact.attributes,
    }),
    ...(meta && ({ meta } as Prisma.JsonObject)),
    singleUseId,
    ...(variables && { variables }),
    ttc: ttc,
    createdAt,
    updatedAt,
  };
};
