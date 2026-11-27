/**
 * Deletes `ids` a chunk at a time, `chunkSize` in flight at once, and stops at the first chunk with a
 * failure. Returns the ids that were deleted, so a caller can take them off the table even when a later
 * one failed, and the first failure, if any. Never throws.
 */
export const deleteInChunks = async (
  ids: readonly string[],
  deleteOne: (id: string) => Promise<unknown>,
  chunkSize: number
): Promise<{ deleted: string[]; error?: unknown }> => {
  const deleted: string[] = [];
  for (let i = 0; i < ids.length; i += chunkSize) {
    const chunk = ids.slice(i, i + chunkSize);
    const results = await Promise.allSettled(chunk.map((id) => deleteOne(id)));
    chunk.forEach((id, index) => {
      if (results[index].status === "fulfilled") deleted.push(id);
    });
    const failure = results.find((result): result is PromiseRejectedResult => result.status === "rejected");
    if (failure) return { deleted, error: failure.reason };
  }
  return { deleted };
};
