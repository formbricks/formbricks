import "server-only";
import { isUniqueConstraintError } from "@/lib/utils/prisma-error";

/** How often a generated "(copy)" name is retried when a concurrent copy took it first. */
export const MAX_COPY_NAME_ATTEMPTS = 3;

export type TCopyNameResult<T> = { nameTaken: false; value: T } | { nameTaken: true };

/**
 * Run `create` for a duplicate and report a name clash rather than throwing it. A name the caller chose is
 * theirs to change, so a clash with it is reported at once. A generated "(copy)" name can only clash with a
 * concurrent copy taking it first, so `create` (which picks the next free name again) is retried, up to
 * `MAX_COPY_NAME_ATTEMPTS` times. Any other error is thrown.
 */
export const createWithCopyNameRetries = async <T>(
  create: () => Promise<T>,
  { nameChosen }: { nameChosen: boolean }
): Promise<TCopyNameResult<T>> => {
  for (let attempt = 1; ; attempt++) {
    try {
      return { nameTaken: false, value: await create() };
    } catch (error) {
      if (!isUniqueConstraintError(error)) throw error;
      if (nameChosen || attempt >= MAX_COPY_NAME_ATTEMPTS) return { nameTaken: true };
    }
  }
};
