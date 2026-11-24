import { prisma } from "@formbricks/database";
import { Prisma } from "@formbricks/database/prisma";
import { InvalidInputError } from "@formbricks/types/errors";
import { TSegment, TSegmentUpdateInput } from "@formbricks/types/segment";
import { isUniqueConstraintError } from "@/lib/utils/prisma-error";
import { SEGMENT_TITLE_TAKEN_ERROR_MESSAGE } from "./segment-errors";

/**
 * The surveys whose ids may title a segment of this directory, or of this workspace for a segment
 * without a directory (made before the workspace had one).
 */
const surveysSharingTitles = (
  directoryId: string | null,
  workspaceId: string | null
): Prisma.SurveyWhereInput =>
  directoryId
    ? { workspace: { contactDirectoryId: directoryId } }
    : { workspaceId: workspaceId ?? undefined };

/**
 * ENG-6956: a survey's private targeting segment is stored under the survey's id as its title, and the
 * survey save finds (or connects to) it by that title. A segment a caller titles freely must therefore
 * never take the id of a survey whose private segment would share its title scope: any survey of the
 * directory, since titles are unique per directory (decision 24).
 */
export const assertTitleIsNotSurveyId = async (
  directoryId: string | null,
  workspaceId: string | null,
  title: string
): Promise<void> => {
  const survey = await prisma.survey.findFirst({
    where: { id: title, ...surveysSharingTitles(directoryId, workspaceId) },
    select: { id: true },
  });
  if (survey) {
    throw new InvalidInputError("A segment cannot be titled with the id of a survey");
  }
};

const isRename = (data: TSegmentUpdateInput, current: TSegment): boolean =>
  data.title !== undefined && data.title !== current.title;

/**
 * A segment that stays private keeps its survey's id as title: the survey save finds it by that title, so
 * a renamed one would be left behind and a new one created (ENG-6956). Turning it shared may rename it.
 */
export const assertPrivateSegmentKeepsTitle = (data: TSegmentUpdateInput, current: TSegment): void => {
  const staysPrivate = current.isPrivate && data.isPrivate !== false;
  if (staysPrivate && isRename(data, current)) {
    throw new InvalidInputError("A private segment keeps the id of its survey as title");
  }
};

/**
 * A rename, or a private segment turned shared while it keeps its survey's id as title, stores a title
 * the caller chose for a segment the survey save may later pick up by that title (ENG-6956).
 */
export const needsSurveyIdTitleCheck = (data: TSegmentUpdateInput, current: TSegment): boolean => {
  const becomesShared = current.isPrivate && data.isPrivate === false;
  return isRename(data, current) || becomesShared;
};

/**
 * Titles are unique per directory, so a create or rename onto a title another segment holds (a survey's
 * private segment included) is the caller's input error, not a database fault.
 */
export const throwSegmentTitleTaken = (error: unknown): void => {
  if (isUniqueConstraintError(error)) {
    throw new InvalidInputError(SEGMENT_TITLE_TAKEN_ERROR_MESSAGE);
  }
};
