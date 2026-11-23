import type { SegmentWhereInput, SegmentWhereUniqueInput } from "@formbricks/database/prisma";

// Which segments a workspace reaches. A segment belongs to a contact directory, and every workspace on it
// shares its public segments (decision 24); `Segment.workspaceId` only records where one was made.

/**
 * The segments a workspace sees: the shared ones of its contact directory, whichever workspace made them
 * (decision 24), and the private ones of its own surveys. Another workspace's private segments are its
 * surveys' own filters, never listed. Spread it to add more conditions.
 */
export const whereSegmentsOfWorkspace = (workspaceId: string, directoryId: string): SegmentWhereInput => ({
  directoryId,
  OR: [{ isPrivate: false }, { workspaceId }],
});

/**
 * `whereSegmentsOfWorkspace`'s private-segment rule for a segment already read, once its directory is
 * known to be the workspace's: shared, or private to this workspace's own surveys.
 */
export const isSegmentVisibleToWorkspace = (
  segment: { isPrivate: boolean; workspaceId: string | null },
  workspaceId: string
): boolean => !segment.isPrivate || segment.workspaceId === workspaceId;

/**
 * Where a survey's private segment is found: its title, the survey's id, in the workspace's directory.
 * A workspace with no directory (decision 3) still gives its app surveys a private segment, keyed in the
 * workspace until a directory is picked for it.
 */
export const privateSegmentKey = (
  workspaceId: string,
  directoryId: string | null,
  surveyId: string
): SegmentWhereUniqueInput =>
  directoryId
    ? { directoryId_title: { directoryId, title: surveyId } }
    : { workspaceId_title: { workspaceId, title: surveyId } };
