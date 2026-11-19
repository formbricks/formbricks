/**
 * Next/Back in the response modal record the response they left from. Navigation is in flight, and both
 * buttons are disabled, until the selection moves off that response.
 */
export const isNavigationInFlight = (
  navigatingFromId: string | null,
  selectedResponseId: string | null
): boolean => navigatingFromId !== null && navigatingFromId === selectedResponseId;

/**
 * The recorded response after the selection changes to `nextSelectedId`. Clearing the selection (closing
 * the modal, deleting the open response) ends any navigation, so reopening the response a Next/Back click
 * left from does not find it still in flight.
 */
export const navigatingFromIdAfterSelect = (
  navigatingFromId: string | null,
  nextSelectedId: string | null
): string | null => (nextSelectedId === null ? null : navigatingFromId);
