import { Prisma } from "@formbricks/database/prisma";
import { TContactAttributes } from "@formbricks/types/contact-attribute";
import { TResponseInput } from "@formbricks/types/responses";
import { normalizeResponseLanguage } from "@/lib/response/utils";

export const buildPrismaResponseData = (
  responseInput: TResponseInput,
  contact: { id: string; attributes: TContactAttributes } | null,
  ttc: Record<string, number>
): Prisma.ResponseCreateInput => {
  const {
    surveyId,
    displayId,
    finished,
    endingId,
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
    endingId: endingId ?? null,
    data: data,
    language: normalizeResponseLanguage(language),
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
