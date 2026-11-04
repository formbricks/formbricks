import "server-only";
import { createHash, randomUUID } from "node:crypto";
import { z } from "zod";
import { type CacheKey, createCacheKey } from "@formbricks/cache";
import { logger } from "@formbricks/logger";
import { loggableError } from "@/app/api/v3/lib/loggable-error";
import { cache } from "@/lib/cache";
import {
  SURVEY_IMPORT_IDEMPOTENCY_IN_FLIGHT_MS,
  SURVEY_IMPORT_IDEMPOTENCY_TTL_MS,
} from "@/modules/survey/import/limits";

/**
 * `Idempotency-Key` for `POST /api/internal/surveys/imports` (ENG-6850), after the IETF
 * Idempotency-Key header draft: the dialog sends one key per review, so a retried or double-sent create
 * makes one survey.
 *
 * The key — scoped to the user who sent it, hashed — maps in Redis to a fingerprint of the request it
 * was first used for, and, once that request has created its survey, the survey's id, for 24 hours:
 *
 * - a repeat of a finished request is answered with the same 201, nothing created;
 * - the same key with a different request is a 422;
 * - a repeat while the first is still running is a 409;
 * - a request that fails gives its key back, so the dialog can retry with it.
 *
 * Fails open: without Redis the create runs unprotected rather than not at all, as every limit here does
 * (docs/adr/0016-abuse-limits-fail-closed.md), and logs that it did. Every command runs under the cache
 * service's deadline, so a Redis that stops answering takes that path rather than holding the request.
 */

const ZIdempotencyRecord = z.discriminatedUnion("state", [
  z.object({ state: z.literal("in_flight"), fingerprint: z.string(), token: z.string() }),
  z.object({ state: z.literal("done"), fingerprint: z.string(), surveyId: z.string() }),
]);

type TIdempotencyRecord = z.infer<typeof ZIdempotencyRecord>;

export type TIdempotencyClaim =
  /** The key is this request's: run it, then `complete` or `release`. */
  | { kind: "claimed"; complete: (surveyId: string) => Promise<void>; release: () => Promise<void> }
  /** The same request already created this survey. */
  | { kind: "replay"; surveyId: string }
  /** The same key is held by a request that is still running. */
  | { kind: "in_flight" }
  /** The key was used for a different request. */
  | { kind: "mismatch" }
  /** Redis did not answer: run the request without the guarantee. */
  | { kind: "unavailable" };

/**
 * Records the finished request — unless another request holds the key. The in-flight record can expire
 * while a slow create runs, and a retry can then claim the key: writing over its claim would let a third
 * request in. With no record left, the finished one is still written, so a retry after it replays.
 */
const COMPLETE_SCRIPT = `
  local current = redis.call('GET', KEYS[1])
  if current == false or current == ARGV[1] then
    redis.call('SET', KEYS[1], ARGV[2], 'PX', ARGV[3])
    return 1
  end
  return 0
`;

/** Deletes the key only while it still holds this request's in-flight record. */
const RELEASE_SCRIPT = `
  if redis.call('GET', KEYS[1]) == ARGV[1] then
    return redis.call('DEL', KEYS[1])
  end
  return 0
`;

const sha256 = (text: string): string => createHash("sha256").update(text).digest("hex");

/** Where a user's key is kept: hashed, so the key the client chose never reaches Redis as sent. */
export const getSurveyImportIdempotencyCacheKey = (userId: string, idempotencyKey: string): CacheKey =>
  createCacheKey.surveyImport.idempotency(userId, sha256(idempotencyKey));

/** What makes two requests the same one: their body, byte for byte as the route parsed it. */
export const fingerprintSurveyImportRequest = (body: unknown): string => sha256(JSON.stringify(body));

/** A stored record, or `null` for none — or for one this code cannot read, which is treated as gone. */
const parseRecord = (value: string | null): TIdempotencyRecord | null => {
  if (value === null) return null;
  try {
    return ZIdempotencyRecord.safeParse(JSON.parse(value)).data ?? null;
  } catch {
    return null;
  }
};

const answerFromExisting = (
  record: TIdempotencyRecord | null,
  fingerprint: string
): TIdempotencyClaim | null => {
  if (!record) return null;
  if (record.fingerprint !== fingerprint) return { kind: "mismatch" };
  return record.state === "done" ? { kind: "replay", surveyId: record.surveyId } : { kind: "in_flight" };
};

/**
 * Claim `idempotencyKey` for this user's request, or learn what an earlier request with it did.
 */
export const claimSurveyImportIdempotencyKey = async ({
  userId,
  idempotencyKey,
  fingerprint,
}: {
  userId: string;
  idempotencyKey: string;
  fingerprint: string;
}): Promise<TIdempotencyClaim> => {
  const key = getSurveyImportIdempotencyCacheKey(userId, idempotencyKey);
  const inFlightRecord: TIdempotencyRecord = { state: "in_flight", fingerprint, token: randomUUID() };
  const inFlight = JSON.stringify(inFlightRecord);

  try {
    if (!(await cache.getRedisClient())) {
      logger.warn("Survey import idempotency unavailable: no Redis client; creating without it");
      return { kind: "unavailable" };
    }

    // Twice at most: a record can expire between the failed claim and the read.
    for (let attempt = 0; attempt < 2; attempt++) {
      const claimed = await cache.runRedisOperation((redis) =>
        redis.set(key, inFlight, { NX: true, PX: SURVEY_IMPORT_IDEMPOTENCY_IN_FLIGHT_MS })
      );
      if (claimed === "OK") {
        return {
          kind: "claimed",
          complete: async (surveyId) => {
            const done: TIdempotencyRecord = { state: "done", fingerprint, surveyId };
            const recorded = await cache.runRedisOperation((redis) =>
              redis.eval(COMPLETE_SCRIPT, {
                keys: [key],
                arguments: [inFlight, JSON.stringify(done), String(SURVEY_IMPORT_IDEMPOTENCY_TTL_MS)],
              })
            );
            if (recorded !== 1) {
              logger.warn(
                "Survey import's Idempotency-Key was claimed again before it finished; not recorded"
              );
            }
          },
          release: async () => {
            await cache.runRedisOperation((redis) =>
              redis.eval(RELEASE_SCRIPT, { keys: [key], arguments: [inFlight] })
            );
          },
        };
      }

      const stored = await cache.runRedisOperation((redis) => redis.get(key));
      const answer = answerFromExisting(parseRecord(stored), fingerprint);
      if (answer) return answer;
    }

    return { kind: "in_flight" };
  } catch (error) {
    logger.warn({ ...loggableError(error) }, "Survey import idempotency unavailable; creating without it");
    return { kind: "unavailable" };
  }
};
