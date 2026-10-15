/** Run `fn` over `items` with at most `limit` in flight, preserving input order in the output. */
export const mapWithConcurrency = async <TIn, TOut>(
  items: readonly TIn[],
  limit: number,
  fn: (item: TIn) => Promise<TOut>
): Promise<TOut[]> => {
  const results = new Array<TOut>(items.length);
  let cursor = 0;

  const worker = async (): Promise<void> => {
    while (cursor < items.length) {
      const index = cursor;
      cursor += 1;
      results[index] = await fn(items[index]);
    }
  };

  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));

  return results;
};
