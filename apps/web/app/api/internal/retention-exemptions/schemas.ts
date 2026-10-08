import { z } from "zod";
import {
  type TKeysetCursor,
  computeFilterFingerprint,
  decodeKeysetCursor,
} from "@/app/api/v3/lib/keyset-cursor";
import { RETENTION_EXEMPTION_POLICIES } from "@/modules/ee/data-retention/types";

export const RETENTION_EXEMPTIONS_CURSOR_KIND = "retention-exemptions";
export const RETENTION_EXEMPTIONS_SORT = "-createdAt";
export const RETENTION_EXEMPTIONS_DEFAULT_LIMIT = 25;
export const RETENTION_EXEMPTIONS_MAX_LIMIT = 100;

export const RETENTION_EXEMPTION_REASON_MAX_LENGTH = 500;
/** How far ahead an exemption may end. Open-ended exemptions are out of scope (ENG-3346). */
export const RETENTION_EXEMPTION_MAX_YEARS = 10;

export const RETENTION_EXEMPTION_SURVEY_OPTIONS_DEFAULT_LIMIT = 20;
export const RETENTION_EXEMPTION_SURVEY_OPTIONS_MAX_LIMIT = 50;

/** The filters an exemptions cursor is bound to, so it can't continue a walk in another organisation. */
export const retentionExemptionsFingerprint = ({ organizationId }: { organizationId: string }): string =>
  computeFilterFingerprint({ organizationId });

/**
 * `GET /api/internal/retention-exemptions` query. The cursor is decoded here, in the parse layer, so a
 * malformed or mismatched cursor is a 400 on `cursor` like any other invalid parameter.
 */
export const ZRetentionExemptionsListQuery = z
  .object({
    organizationId: z.cuid2(),
    limit: z.coerce
      .number()
      .int()
      .min(1)
      .max(RETENTION_EXEMPTIONS_MAX_LIMIT)
      .default(RETENTION_EXEMPTIONS_DEFAULT_LIMIT),
    cursor: z.string().trim().min(1).optional(),
  })
  .strict()
  .transform((query, ctx) => {
    const fingerprint = retentionExemptionsFingerprint(query);
    let cursor: TKeysetCursor | null = null;

    if (query.cursor) {
      try {
        cursor = decodeKeysetCursor(query.cursor, {
          kind: RETENTION_EXEMPTIONS_CURSOR_KIND,
          sortBy: RETENTION_EXEMPTIONS_SORT,
          fp: fingerprint,
        });
      } catch (error) {
        ctx.addIssue({
          code: "custom",
          path: ["cursor"],
          message: error instanceof Error ? error.message : "The cursor is invalid.",
        });
        return z.NEVER;
      }
    }

    return { ...query, cursor, fingerprint };
  });

export type TRetentionExemptionsListQuery = z.infer<typeof ZRetentionExemptionsListQuery>;

export const ZRetentionExemptionPathParams = z.object({ exemptionId: z.cuid2() }).strict();

/**
 * `POST /api/internal/retention-exemptions` body. The organisation is never taken from the body: it is
 * the survey's. Whether `until` is in range depends on the current time, so that is a business rule
 * checked by the operation (422), not here.
 */
export const ZCreateRetentionExemptionBody = z
  .object({
    surveyId: z.cuid2(),
    policy: z.enum(RETENTION_EXEMPTION_POLICIES),
    until: z.iso.datetime({ offset: true }).transform((value) => new Date(value)),
    reason: z.string().trim().min(1).max(RETENTION_EXEMPTION_REASON_MAX_LENGTH),
  })
  .strict();

export type TCreateRetentionExemptionBody = z.infer<typeof ZCreateRetentionExemptionBody>;

/** `GET /api/internal/retention-exemptions/survey-options` query, for the Add exemption picker. */
export const ZRetentionExemptionSurveyOptionsQuery = z
  .object({
    organizationId: z.cuid2(),
    search: z.string().trim().max(200).default(""),
    limit: z.coerce
      .number()
      .int()
      .min(1)
      .max(RETENTION_EXEMPTION_SURVEY_OPTIONS_MAX_LIMIT)
      .default(RETENTION_EXEMPTION_SURVEY_OPTIONS_DEFAULT_LIMIT),
  })
  .strict();

export type TRetentionExemptionSurveyOptionsQuery = z.infer<typeof ZRetentionExemptionSurveyOptionsQuery>;
