import { Prisma } from "@formbricks/database/prisma";
import { DatabaseError } from "@formbricks/types/errors";

/**
 * True when an error is a transient database connection-pool exhaustion (Prisma `P2024`, or a
 * connection-pool timeout surfaced as a message). These are retryable: a background job that hits
 * one should propagate the error so it is retried, rather than swallow it and silently drop work.
 *
 * Shared by the response-pipeline job and the workflow runner enqueue so both classify retryable
 * DB exhaustion the same way (and so the runner can rethrow it without importing the pipeline).
 */
export const isDatabasePoolExhaustionError = (error: unknown): boolean => {
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2024") {
    return true;
  }

  if (error instanceof DatabaseError || error instanceof Error) {
    return /Timed out fetching a new connection from the connection pool|connection pool timeout/i.test(
      error.message
    );
  }

  return false;
};
