import { Prisma } from "@formbricks/database/prisma";
import { normalizeLanguageCode } from "@formbricks/i18n-utils/src/canonical";
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
    // Canonicalize on write (ENG-1067): stale SDK caches can submit a legacy code (e.g. "hi"); store
    // its canonical BCP-47 form ("hi-IN") so the table stays canonical. "default" and unresolvable
    // values are preserved (normalizeLanguageCode returns null → keep the original).
    language: language ? (normalizeLanguageCode(language) ?? language) : language,
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
