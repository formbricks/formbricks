import "server-only";
import { prisma } from "@formbricks/database";
import { logger } from "@formbricks/logger";
import type { TEmbeddedValueResponse } from "@formbricks/types/embedded-data-resolver";
import type {
  TResponseData,
  TResponseDataValue,
  TResponseMeta,
  TResponseTtc,
  TResponseVariables,
} from "@formbricks/types/responses";
import { IS_FORMBRICKS_CLOUD } from "@/lib/constants";
import { getOrganization } from "@/lib/organization/service";
import { screenResponseQuotas } from "@/modules/ee/quotas/lib/evaluation-service";
import type { TV3ResponseRow } from "./service";
import type { TV3WriteSurveyRow } from "./write-service";

/**
 * What a successful write would do, reported without doing it — `ResponseValidationEffects` in the
 * contract.
 *
 * Every field here is derived from the same inputs the write itself uses, never re-decided. Where
 * that is not possible the field says so rather than guessing: see `firesPipeline` on a patch.
 */
export type TV3ResponseValidationEffects = {
  language: string | null;
  contactId: string | null;
  displayId: string | null;
  firesPipeline: boolean;
  countsTowardMeteredResponses: boolean;
  quotas: {
    quotaId: string;
    quotaName: string;
    wouldCount: boolean;
    wouldFill?: boolean;
  }[];
  tagsToApply?: string[];
};

/**
 * The response shape quota screening resolves `reserved` operands against, built from the payload
 * rather than from a row.
 *
 * This is the one place a dry run has to fabricate something, because the fields it describes only
 * exist once the row does. It is built from exactly the values the write would persist — the same
 * `composed` maps, the same normalized `ttc`, the caller's `meta` — so a quota on `country` or
 * `browser` screens the payload the way it will screen the response. The two timestamps are the
 * honest approximation: a write happening now would carry roughly these.
 */
const asQuotaScreeningResponse = ({
  variables,
  ...row
}: Omit<TEmbeddedValueResponse, "variables"> & {
  variables: Record<string, TResponseDataValue>;
}): TEmbeddedValueResponse => ({
  ...row,
  // The plan carries the write's own composition type, which is wider than what a response stores:
  // `ZResponseVariables` is a record of scalars, and the logic engine writes nothing else. Narrowed
  // here rather than at the three call sites that would each need the same justification.
  variables: variables as TResponseVariables,
});

/**
 * Which of the survey's quotas this payload would count against, and which it would fill.
 *
 * Every quota the survey defines is listed, not only the matching ones: an importer checking why a
 * payload is not being counted needs to see the quota it missed, not an empty array.
 *
 * `wouldCount` is "the content matches the quota's criteria", which is what `screenResponseQuotas`
 * decides. `wouldFill` compares the *stored* screened-in count against the limit, so it answers
 * about the quota as it stands now — a concurrent write can change it before the real create runs,
 * and no dry run can promise otherwise.
 */
const quotaEffects = async ({
  surveyId,
  response,
}: {
  surveyId: string;
  response: TEmbeddedValueResponse;
}): Promise<TV3ResponseValidationEffects["quotas"]> => {
  const screening = await screenResponseQuotas({
    surveyId,
    data: response.data,
    variables: response.variables,
    language: response.language ?? "default",
    response,
  });

  if (!screening) return [];

  const passedIds = new Set(screening.passedQuotas.map((quota) => quota.id));

  const counts =
    screening.passedQuotas.length > 0
      ? await prisma.responseQuotaLink.groupBy({
          by: ["quotaId"],
          where: {
            quotaId: { in: screening.passedQuotas.map((quota) => quota.id) },
            status: "screenedIn",
            // The same predicate `handleQuotas` counts with, minus its exclusion of the response
            // being written — there is no such response here.
            OR: [{ quota: { countPartialSubmissions: true } }, { response: { finished: true } }],
          },
          _count: { responseId: true },
        })
      : [];

  const countsByQuota = new Map(counts.map((row) => [row.quotaId, row._count.responseId]));

  return screening.quotas.map((quota) => {
    const wouldCount = passedIds.has(quota.id);

    if (!wouldCount) {
      return { quotaId: quota.id, quotaName: quota.name, wouldCount: false };
    }

    return {
      quotaId: quota.id,
      quotaName: quota.name,
      wouldCount: true,
      wouldFill: (countsByQuota.get(quota.id) ?? 0) + 1 >= quota.limit,
    };
  });
};

/**
 * Whether the write would consume one metered monthly response.
 *
 * Metering happens in the response pipeline's `responseCreated` side effects and is gated on Cloud
 * plus an organization that has a Stripe customer — so a patch is never metered, and neither is a
 * create on a self-hosted instance or an organization that has never had a subscription.
 */
const wouldMeter = async (organizationId: string): Promise<boolean> => {
  if (!IS_FORMBRICKS_CLOUD) return false;

  const organization = await getOrganization(organizationId);

  return Boolean(organization?.billing?.stripeCustomerId);
};

/**
 * Effects are reported on a best-effort basis: a payload that validates is valid whether or not the
 * quota screening behind `effects.quotas` could be read. Failing the whole request because a
 * secondary read failed would turn a working validation into a 500.
 */
const withoutFailing = async <T>(work: () => Promise<T>, fallback: T, context: string): Promise<T> => {
  try {
    return await work();
  } catch (error) {
    logger.warn({ err: error }, `Response validation could not compute ${context}`);
    return fallback;
  }
};

export async function createEffects({
  survey,
  organizationId,
  finished,
  language,
  data,
  variables,
  ttc,
  meta,
  contactId,
  displayId,
}: {
  survey: TV3WriteSurveyRow;
  organizationId: string;
  finished: boolean;
  language: string | null;
  data: TResponseData;
  variables: Record<string, TResponseDataValue>;
  ttc: TResponseTtc;
  meta: TResponseMeta;
  contactId?: string;
  displayId?: string;
}): Promise<TV3ResponseValidationEffects> {
  const now = new Date();
  const response = asQuotaScreeningResponse({
    id: "",
    surveyId: survey.id,
    createdAt: now,
    updatedAt: now,
    finished,
    language,
    data,
    variables,
    ttc,
    meta,
  });

  return {
    language,
    contactId: contactId ?? null,
    displayId: displayId ?? null,
    // A create always dispatches `responseCreated`.
    firesPipeline: true,
    countsTowardMeteredResponses: await withoutFailing(() => wouldMeter(organizationId), false, "metering"),
    quotas: await withoutFailing(() => quotaEffects({ surveyId: survey.id, response }), [], "quotas"),
  };
}

export async function patchEffects({
  survey,
  stored,
  finished,
  language,
  data,
  variables,
  tagsToApply,
}: {
  survey: TV3WriteSurveyRow;
  stored: TV3ResponseRow;
  finished: boolean;
  language: string | null;
  data: TResponseData;
  variables: Record<string, TResponseDataValue>;
  tagsToApply: string[];
}): Promise<TV3ResponseValidationEffects> {
  const response = asQuotaScreeningResponse({
    id: stored.id,
    surveyId: stored.surveyId,
    createdAt: stored.createdAt,
    updatedAt: new Date(),
    finished,
    language,
    data,
    variables,
    ttc: (stored.ttc ?? {}) as TResponseTtc,
    meta: (stored.meta ?? {}) as TResponseMeta,
  });

  return {
    language,
    contactId: stored.contact?.id ?? null,
    displayId: stored.displayId,
    /*
     * `responseFinished` fires on the transition, so a patch that leaves a finished response
     * finished dispatches nothing. One case is not modelled: quota evaluation can itself flip
     * `finished` to true inside the write's transaction when a matched quota's action is
     * `endSurvey`, and a dry run cannot claim that will happen — the quota may be full by then, or
     * not. This reports what the payload asks for.
     */
    firesPipeline: finished && !stored.finished,
    // Metering is a `responseCreated` side effect; a patch never meters.
    countsTowardMeteredResponses: false,
    quotas: await withoutFailing(() => quotaEffects({ surveyId: survey.id, response }), [], "quotas"),
    tagsToApply,
  };
}
