/**
 * A Dashboard Viewer's list page can come back empty with a `nextCursor`: the server stops after a ceiling
 * of candidate dashboards none of which the viewer can open, and the next readable one may lie past it.
 * The list keeps walking such pages on its own, a batch at a time, so a readable dashboard past the
 * ceiling still shows; after a batch of empty pages in a row it stops and offers "Load more" instead of
 * scanning a large workspace unasked. Each "Load more" walks one more batch.
 */
export const EMPTY_PAGES_WALKED_PER_BATCH = 5;

type TListPage = { data: readonly unknown[] };

/** How many pages at the end of the list came back empty, in a row. */
export const countTrailingEmptyPages = (pages: readonly TListPage[]): number => {
  let count = 0;
  for (let index = pages.length - 1; index >= 0 && pages[index].data.length === 0; index--) count++;
  return count;
};

/**
 * Whether to fetch the next page now, unasked: the last page came back empty, there is a next one, nothing
 * is in flight or failed, and the current batch of empty pages is not used up.
 */
export const shouldWalkPastEmptyPage = ({
  pages,
  hasNextPage,
  isFetching,
  isError,
  batchSize = EMPTY_PAGES_WALKED_PER_BATCH,
}: {
  pages: readonly TListPage[] | undefined;
  hasNextPage: boolean;
  isFetching: boolean;
  isError: boolean;
  batchSize?: number;
}): boolean => {
  if (!pages || !hasNextPage || isFetching || isError) return false;
  const trailingEmpty = countTrailingEmptyPages(pages);
  // A full batch (5, 10, …) waits for "Load more"; the page that click fetches starts the next batch.
  return trailingEmpty > 0 && trailingEmpty % batchSize !== 0;
};
