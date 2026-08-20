import { Prisma } from "@formbricks/database/prisma";
import { TContactAttributes } from "@formbricks/types/contact-attribute";
import { type TIngestFlag } from "@formbricks/types/embedded-data-ingest";
import { TResponseInput } from "@formbricks/types/responses";
import { normalizeResponseLanguage } from "@/lib/response/utils";

/**
 * `ingestFlags` is a separate parameter rather than a key on `responseInput` on purpose: it is
 * computed by the server from the incoming data (ENG-1845), and a client-sent flag list could claim
 * "no flags" — the same trust problem as the client's filtering. Keeping it out of `ZResponseInput`
 * makes that unrepresentable instead of a comment. Omitted means "no ingest boundary ran", which
 * leaves the column null; an empty array means "ran, nothing to report".
 */
export const buildPrismaResponseData = (
  responseInput: TResponseInput,
  contact: { id: string; attributes: TContactAttributes } | null,
  ttc: Record<string, number>,
  ingestFlags?: readonly TIngestFlag[]
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
    // Any defined list is persisted, empty included: `null` has to keep meaning "no ingest boundary
    // ran" for the column's documented contract to hold, and on a create an omitted nullable field
    // is already `NULL` — so collapsing `[]` to `null` would make a checked-and-clean response
    // indistinguishable from a legacy one.
    ...(ingestFlags !== undefined && { ingestFlags: [...ingestFlags] }),
    ttc: ttc,
    createdAt,
    updatedAt,
  };
};
