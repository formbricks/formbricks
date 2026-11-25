import { cache as reactCache } from "react";
import { z } from "zod";
import { prisma } from "@formbricks/database";
import { Prisma } from "@formbricks/database/prisma";
import { ZId, ZString } from "@formbricks/types/common";
import {
  DatabaseError,
  OperationNotAllowedError,
  ResourceNotFoundError,
  ValidationError,
} from "@formbricks/types/errors";
import {
  TBaseFilters,
  TSegment,
  TSegmentCreateInput,
  TSegmentUpdateInput,
  TSegmentWithSurveyRefs,
  ZSegmentCreateInput,
  ZSegmentFilters,
  ZSegmentUpdateInput,
} from "@formbricks/types/segment";
import { getSurvey } from "@/lib/survey/service";
import { andVisibleSurveys } from "@/lib/survey/visibility/predicate";
import { escapeLikePattern } from "@/lib/utils/like-pattern";
import { isUniqueConstraintError } from "@/lib/utils/prisma-error";
import { validateInputs } from "@/lib/utils/validate";
import {
  getWorkspaceContactDirectory,
  getWorkspaceContactDirectoryId,
  requireWorkspaceContactDirectory,
} from "@/modules/ee/contacts/lib/contact-directory";
import {
  SURVEY_WORKSPACE_LOOKUP_BATCH_SIZE,
  searchForAttributeKeyInSegment,
} from "@/modules/ee/contacts/segments/lib/utils";
import {
  isSegmentVisibleToWorkspace,
  privateSegmentKey,
  whereSegmentsOfDirectoryOrWorkspace,
  whereSegmentsOfWorkspace,
} from "./segment-scope";
import {
  assertPrivateSegmentKeepsTitle,
  assertTitleIsNotSurveyId,
  needsSurveyIdTitleCheck,
  throwSegmentTitleTaken,
} from "./segment-titles";

export const selectSegment = {
  id: true,
  createdAt: true,
  updatedAt: true,
  title: true,
  description: true,
  workspaceId: true,
  directoryId: true,
  filters: true,
  isPrivate: true,
  surveys: {
    select: {
      id: true,
      name: true,
      status: true,
    },
  },
} satisfies Prisma.SegmentSelect;

export type PrismaSegment = Prisma.SegmentGetPayload<{ select: typeof selectSegment }>;

/**
 * `selectSegment` for a list `workspaceId` reads: the segment's surveys are only that workspace's, through
 * the viewer's visibility clause. A shared segment can target surveys of every workspace on its directory
 * (decision 24); the names and ids of another workspace's surveys never leave the server.
 */
export const selectSegmentForWorkspace = (workspaceId: string, visibleSurveyWhere: Prisma.SurveyWhereInput) =>
  ({
    ...selectSegment,
    surveys: {
      ...selectSegment.surveys,
      where: { workspaceId, ...andVisibleSurveys(visibleSurveyWhere) },
    },
  }) satisfies Prisma.SegmentSelect;

/**
 * A segment as the service reads it, with the contact directory it belongs to. Every scope check compares
 * that directory (decision 24): `workspaceId` is only the workspace the segment was created in.
 */
export type TSegmentWithDirectory = TSegmentWithSurveyRefs & { directoryId: string | null };

export const transformPrismaSegment = (segment: PrismaSegment): TSegmentWithDirectory => {
  const activeSurveys = segment.surveys
    .filter((survey) => survey.status === "inProgress")
    .map((survey) => ({ id: survey.id, name: survey.name }));

  const inactiveSurveys = segment.surveys
    .filter((survey) => survey.status !== "inProgress")
    .map((survey) => ({ id: survey.id, name: survey.name }));

  return {
    ...segment,
    surveys: segment.surveys.map((survey) => survey.id),
    activeSurveys,
    inactiveSurveys,
  };
};

export const getSegment = reactCache(async (segmentId: string): Promise<TSegmentWithDirectory> => {
  validateInputs([segmentId, ZId]);
  try {
    const segment = await prisma.segment.findUnique({
      where: {
        id: segmentId,
      },
      select: selectSegment,
    });

    if (!segment) {
      throw new ResourceNotFoundError("segment", segmentId);
    }

    return transformPrismaSegment(segment);
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      throw new DatabaseError(error.message);
    }

    throw error;
  }
});

/**
 * The filters of several segments in one read, for the recursion check: a level of references costs one
 * query instead of one per segment. Scoped to the segments the workspace reaches, like every other
 * nested-segment read: its directory's shared segments and its own private ones (decision 24), or its own
 * segments while it has no directory (decision 3). A tree naming a segment outside that is refused rather
 * than followed. Only ids that exist come back; the caller reports a missing one, so it names the id its
 * walk met.
 */
export const getSegmentsByIds = async (
  segmentIds: string[],
  workspaceId: string
): Promise<{ id: string; filters: TBaseFilters }[]> => {
  validateInputs([segmentIds, z.array(ZId)], [workspaceId, ZId]);
  try {
    const directory = await getWorkspaceContactDirectory(workspaceId);
    const segments = await prisma.segment.findMany({
      where: {
        id: { in: segmentIds },
        ...(directory ? whereSegmentsOfWorkspace(workspaceId, directory.id) : { workspaceId }),
      },
      select: { id: true, filters: true },
    });
    return segments.map((segment) => ({ id: segment.id, filters: segment.filters as TBaseFilters }));
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      throw new DatabaseError(error.message);
    }

    throw error;
  }
};

/**
 * `getSegments`' survey-reference scope for the server-side callers that need every survey of the workspace
 * a segment is attached to, visible to the viewer or not — reference validation and copy naming, whose
 * results never reach a browser. A shared constant, not an inline `{}`, so `reactCache` keeps its dedupe and every
 * unscoped caller is greppable.
 */
export const ALL_SEGMENT_SURVEY_REFS: Prisma.SurveyWhereInput = Object.freeze({});

/**
 * Each segment's `surveys` / `activeSurveys` / `inactiveSurveys` are the workspace's own surveys only
 * (`selectSegmentForWorkspace`).
 * @param visibleSurveyWhere ENG-3282: the `Survey` clause each segment's `activeSurveys` /
 *   `inactiveSurveys` are read through. Required, so no page can forget it and ship restricted survey
 *   names and ids to the browser: pass `getUserVisibleSurveyWhere(...)` for anything a viewer sees, and
 *   `ALL_SEGMENT_SURVEY_REFS` only where the result stays on the server.
 */
export const getSegments = reactCache(
  async (
    workspaceId: string,
    visibleSurveyWhere: Prisma.SurveyWhereInput
  ): Promise<TSegmentWithDirectory[]> => {
    validateInputs([workspaceId, ZId]);
    try {
      const directory = await getWorkspaceContactDirectory(workspaceId);
      if (!directory) return [];

      const segments = await prisma.segment.findMany({
        where: whereSegmentsOfWorkspace(workspaceId, directory.id),
        select: selectSegmentForWorkspace(workspaceId, visibleSurveyWhere),
      });

      if (!segments) {
        return [];
      }

      return segments.map((segment) => transformPrismaSegment(segment));
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        throw new DatabaseError(error.message);
      }

      throw error;
    }
  }
);

export interface TSurveyFilterRef {
  id: string;
  name: string;
  status: string;
}

/**
 * Upper bound on surveys returned for the picker. Keeps the query and client payload from growing
 * unboundedly with the workspace's survey count; the picker searches client-side over this set. A
 * workspace exceeding this many surveys would need server-side search (tracked as a follow-up), which
 * is far beyond any realistic count today.
 */
export const SURVEY_FILTER_REF_LIMIT = 1000;

/**
 * Minimal survey list for the segment survey-interaction filter picker: id + name + status,
 * scoped to the workspace. Survey has a direct workspaceId column so no environment/project join
 * is needed. Bounded by {@link SURVEY_FILTER_REF_LIMIT}, most-recently-updated first.
 */
export const getSurveyRefsForWorkspace = reactCache(
  async (
    workspaceId: string,
    /** ENG-3282: the viewer's survey-visibility clause. */
    visibleSurveyWhere: Prisma.SurveyWhereInput
  ): Promise<TSurveyFilterRef[]> => {
    validateInputs([workspaceId, ZId]);
    try {
      return await prisma.survey.findMany({
        where: { workspaceId, ...andVisibleSurveys(visibleSurveyWhere) },
        select: { id: true, name: true, status: true },
        orderBy: { updatedAt: "desc" },
        take: SURVEY_FILTER_REF_LIMIT,
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        throw new DatabaseError(error.message);
      }
      throw error;
    }
  }
);

/**
 * Returns the subset of `surveyIds` that actually belong to `workspaceId`. Unlike
 * {@link getSurveyRefsForWorkspace} (which caps at {@link SURVEY_FILTER_REF_LIMIT} for the picker),
 * this queries by the exact ids being validated, so it stays correct for workspaces with more than
 * that many surveys — a referenced-but-valid survey outside the picker's recent window is no longer
 * wrongly rejected. Ids are deduplicated and looked up in bounded sequential batches (ENG-2305),
 * mirroring {@link getSurveyWorkspaceIdMap}. Returns an empty set for an empty input without
 * hitting the DB.
 *
 * @param visibleSurveyWhere ENG-3282: the caller's survey-visibility clause. Required, like
 *   {@link getSegments}', so a survey reference is never validated against surveys the caller cannot see
 *   by omission: a hidden id must answer exactly like an unknown one.
 */
export const getExistingWorkspaceSurveyIds = reactCache(
  async (
    workspaceId: string,
    surveyIds: string[],
    visibleSurveyWhere: Prisma.SurveyWhereInput
  ): Promise<Set<string>> => {
    validateInputs([workspaceId, ZId], [surveyIds, z.array(ZId)]);
    const uniqueSurveyIds = Array.from(new Set(surveyIds));
    const existingSurveyIds = new Set<string>();
    if (uniqueSurveyIds.length === 0) return existingSurveyIds;
    try {
      for (let i = 0; i < uniqueSurveyIds.length; i += SURVEY_WORKSPACE_LOOKUP_BATCH_SIZE) {
        const batch = uniqueSurveyIds.slice(i, i + SURVEY_WORKSPACE_LOOKUP_BATCH_SIZE);
        const surveys = await prisma.survey.findMany({
          where: { workspaceId, id: { in: batch }, ...andVisibleSurveys(visibleSurveyWhere) },
          select: { id: true },
        });
        for (const survey of surveys) {
          existingSurveyIds.add(survey.id);
        }
      }
      return existingSurveyIds;
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        throw new DatabaseError(error.message);
      }
      throw error;
    }
  }
);

/**
 * The segment the caller acts on through `workspaceId`, the workspace they work in. A segment belongs to
 * its contact directory and every workspace on it may use it (decision 24), so its own `workspaceId` says
 * nothing about access. One in another directory, or any for a workspace with no directory, is not found.
 */
export const getSegmentInWorkspace = async (
  segmentId: string,
  workspaceId: string
): Promise<TSegmentWithDirectory> => {
  const segment = await getSegment(segmentId);
  if (!(await isSegmentOfWorkspace(segment, workspaceId))) {
    throw new ResourceNotFoundError("segment", segmentId);
  }
  return segment;
};

/**
 * Whether `workspaceId` may use the segment: it is in the workspace's contact directory (decision 24) and
 * is shared, or is a private one of this workspace's own surveys (the rule of `whereSegmentsOfWorkspace`).
 */
export const isSegmentOfWorkspace = async (
  segment: Pick<TSegmentWithDirectory, "directoryId" | "isPrivate" | "workspaceId">,
  workspaceId: string
): Promise<boolean> => {
  const directory = await getWorkspaceContactDirectory(workspaceId);
  if (segment.directoryId !== directory?.id) return false;
  return isSegmentVisibleToWorkspace(segment, workspaceId);
};

/**
 * The subset of `surveyIds` that are surveys of another workspace on `workspaceId`'s contact directory. A
 * shared segment's survey-interaction filters can name them (decision 24); the editor shows each as
 * "Survey in another workspace" and keeps it. Ids only: the caller may not see those surveys, so their
 * names never leave the server. Empty for a workspace with no directory.
 */
export const getOtherWorkspaceSurveyIds = async (
  workspaceId: string,
  surveyIds: string[]
): Promise<string[]> => {
  validateInputs([workspaceId, ZId], [surveyIds, z.array(ZId)]);
  const uniqueSurveyIds = Array.from(new Set(surveyIds));
  if (uniqueSurveyIds.length === 0) return [];
  const directory = await getWorkspaceContactDirectory(workspaceId);
  if (!directory) return [];
  try {
    const otherWorkspaceSurveyIds: string[] = [];
    for (let i = 0; i < uniqueSurveyIds.length; i += SURVEY_WORKSPACE_LOOKUP_BATCH_SIZE) {
      const batch = uniqueSurveyIds.slice(i, i + SURVEY_WORKSPACE_LOOKUP_BATCH_SIZE);
      // Sequential on purpose: caps concurrent database work, as getSurveyWorkspaceIdMap does.
      const surveys = await prisma.survey.findMany({
        where: {
          id: { in: batch },
          workspaceId: { not: workspaceId },
          workspace: { contactDirectoryId: directory.id },
        },
        select: { id: true },
      });
      otherWorkspaceSurveyIds.push(...surveys.map((survey) => survey.id));
    }
    return otherWorkspaceSurveyIds;
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      throw new DatabaseError(error.message);
    }
    throw error;
  }
};

/**
 * A survey's private targeting segment: created on its first save, updated on later ones (auto-save may
 * already have made it). ENG-6956: keyed by the survey's id, chosen here (see ZSegmentCreateInput); the
 * caller authorizes `survey.write` on `surveyId`. The update reaches only a private segment no other
 * survey uses. Prisma runs this upsert as a read then a write, so two first saves can race; the one that
 * loses finds the row on its second try. A second clash means another segment holds the title.
 */
const upsertPrivateSegment = async ({
  workspaceId,
  surveyId,
  description,
  filters,
}: Pick<TSegmentCreateInput, "workspaceId" | "surveyId" | "description" | "filters">) => {
  const directoryId = await getWorkspaceContactDirectoryId(workspaceId);
  const upsert = () =>
    prisma.segment.upsert({
      // A shared segment holding the title, or a private one other surveys also use (only possible
      // through older bugs), is not this survey's to rewrite: the create clashes and the save is refused.
      where: {
        ...privateSegmentKey(workspaceId, directoryId, surveyId),
        isPrivate: true,
        surveys: { every: { id: surveyId } },
      },
      create: {
        workspaceId,
        directoryId,
        title: surveyId,
        description,
        isPrivate: true,
        filters,
        surveys: { connect: { id: surveyId } },
      },
      update: { description, filters, surveys: { connect: { id: surveyId } } },
      select: selectSegment,
    });

  try {
    return await upsert();
  } catch (error) {
    if (!isUniqueConstraintError(error)) throw error;
    return await upsert();
  }
};

export const createSegment = async (segmentCreateInput: TSegmentCreateInput): Promise<TSegment> => {
  validateInputs([segmentCreateInput, ZSegmentCreateInput]);

  const { description, filters, isPrivate, surveyId, title, workspaceId } = segmentCreateInput;

  const surveyConnect = surveyId ? { surveys: { connect: { id: surveyId } } } : {};

  try {
    if (isPrivate) {
      return transformPrismaSegment(await upsertPrivateSegment(segmentCreateInput));
    }

    // A shared segment belongs to the directory, so a workspace with none cannot make one (decision 13).
    const directory = await requireWorkspaceContactDirectory(workspaceId);
    await assertTitleIsNotSurveyId(directory.id, workspaceId, title);

    const segment = await prisma.segment.create({
      data: {
        workspaceId,
        directoryId: directory.id,
        title,
        description,
        isPrivate,
        filters,
        ...surveyConnect,
      },
      select: selectSegment,
    });

    return transformPrismaSegment(segment);
  } catch (error) {
    throwSegmentTitleTaken(error);
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      throw new DatabaseError(error.message);
    }

    throw error;
  }
};

/**
 * A copy of the segment for the survey, in the segment's directory. `workspaceId` is the survey's
 * workspace, recorded as the copy's origin; the caller has checked the segment is in its directory.
 */
export const cloneSegment = async (
  segmentId: string,
  surveyId: string,
  workspaceId: string
): Promise<TSegment> => {
  validateInputs([segmentId, ZId], [surveyId, ZId], [workspaceId, ZId]);

  try {
    const segment = await getSegment(segmentId);
    if (!segment) {
      throw new ResourceNotFoundError("segment", segmentId);
    }

    if (!segment.directoryId) {
      throw new DatabaseError("Segment is not associated with a contact directory");
    }

    // Titles are unique per directory, so the copy's number counts the directory's copies.
    const copyTitles = await prisma.segment.findMany({
      where: {
        directoryId: segment.directoryId,
        title: { startsWith: escapeLikePattern(`Copy of ${segment.title}`) },
      },
      select: { title: true },
    });

    // Find the last "Copy of" title and extract the number from it
    const lastCopyTitle = copyTitles.map((existingSegment) => existingSegment.title).pop();

    let suffix = 1;
    if (lastCopyTitle) {
      const regex = /\((\d+)\)$/;
      const match = regex.exec(lastCopyTitle);
      if (match) {
        suffix = parseInt(match[1], 10) + 1;
      }
    }

    // Construct the title for the cloned segment
    const clonedTitle = `Copy of ${segment.title} (${suffix})`;

    // parse the filters and update the user segment
    const parsedFilters = ZSegmentFilters.safeParse(segment.filters);
    if (!parsedFilters.success) {
      throw new ValidationError("Invalid filters");
    }

    const clonedSegment = await prisma.segment.create({
      data: {
        title: clonedTitle,
        description: segment.description,
        isPrivate: segment.isPrivate,
        workspaceId,
        directoryId: segment.directoryId,
        filters: segment.filters,
        surveys: {
          connect: {
            id: surveyId,
          },
        },
      },
      select: selectSegment,
    });

    return transformPrismaSegment(clonedSegment);
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      throw new DatabaseError(error.message);
    }

    throw error;
  }
};

export const deleteSegment = async (segmentId: string): Promise<TSegment> => {
  validateInputs([segmentId, ZId]);

  try {
    const currentSegment = await getSegment(segmentId);
    if (!currentSegment) {
      throw new ResourceNotFoundError("segment", segmentId);
    }

    if (currentSegment.surveys?.length) {
      throw new OperationNotAllowedError("Cannot delete a segment that is associated with a survey");
    }

    const segment = await prisma.segment.delete({
      where: {
        id: segmentId,
      },
      select: selectSegment,
    });

    return transformPrismaSegment(segment);
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      throw new DatabaseError(error.message);
    }

    throw error;
  }
};

export const resetSegmentInSurvey = async (surveyId: string): Promise<TSegment> => {
  validateInputs([surveyId, ZId]);

  const survey = await getSurvey(surveyId);
  if (!survey) {
    throw new ResourceNotFoundError("survey", surveyId);
  }

  const directoryId = await getWorkspaceContactDirectoryId(survey.workspaceId);

  try {
    return await prisma.$transaction(async (tx) => {
      // for this survey, does a private segment already exist. Titles are unique per directory only, so
      // another directory can hold a private segment titled with this survey's id (ENG-7389).
      const segment = await tx.segment.findFirst({
        where: {
          ...whereSegmentsOfDirectoryOrWorkspace(directoryId, survey.workspaceId),
          title: surveyId,
          isPrivate: true,
        },
        select: selectSegment,
      });

      // if a private segment already exists, connect it to the survey
      if (segment) {
        await tx.survey.update({
          where: { id: surveyId },
          data: { segment: { connect: { id: segment.id } } },
        });

        // reset the filters
        const updatedSegment = await tx.segment.update({
          where: { id: segment.id },
          data: { filters: [] },
          select: selectSegment,
        });

        return transformPrismaSegment(updatedSegment);
      } else {
        // This case should never happen because a private segment with the title of the surveyId
        // should always exist. But, handling it just in case.

        // if a private segment does not exist, create one
        const newPrivateSegment = await tx.segment.create({
          data: {
            title: surveyId,
            isPrivate: true,
            filters: [],
            surveys: { connect: { id: surveyId } },
            workspaceId: survey.workspaceId,
            directoryId,
          },
          select: selectSegment,
        });

        return transformPrismaSegment(newPrivateSegment);
      }
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      throw new DatabaseError(error.message);
    }

    throw error;
  }
};

/**
 * Batched lookup of the owning workspace for a set of surveys, used to keep segment↔survey links
 * within one workspace (ENG-1920). Ids are deduplicated and queried in bounded batches — one query
 * per batch rather than one per id, so the non-N+1 shape is preserved without letting a
 * caller-controlled array size the SQL parameter payload (ENG-2004). Batches run sequentially: the
 * point is to cap concurrent database work, not to fan it out. Missing ids are simply absent from
 * the returned map.
 */
export const getSurveyWorkspaceIdMap = reactCache(
  async (surveyIds: string[]): Promise<Map<string, string>> => {
    const uniqueSurveyIds = Array.from(new Set(surveyIds));
    const workspaceIdBySurveyId = new Map<string, string>();

    if (uniqueSurveyIds.length === 0) {
      return workspaceIdBySurveyId;
    }

    try {
      for (let i = 0; i < uniqueSurveyIds.length; i += SURVEY_WORKSPACE_LOOKUP_BATCH_SIZE) {
        const batch = uniqueSurveyIds.slice(i, i + SURVEY_WORKSPACE_LOOKUP_BATCH_SIZE);
        const surveys = await prisma.survey.findMany({
          where: { id: { in: batch } },
          select: { id: true, workspaceId: true },
        });

        for (const survey of surveys) {
          workspaceIdBySurveyId.set(survey.id, survey.workspaceId);
        }
      }

      return workspaceIdBySurveyId;
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        throw new DatabaseError(error.message);
      }
      throw error;
    }
  }
);

export const updateSegment = async (segmentId: string, data: TSegmentUpdateInput): Promise<TSegment> => {
  validateInputs([segmentId, ZId], [data, ZSegmentUpdateInput]);

  try {
    let updatedInput: Prisma.SegmentUpdateInput = {
      ...data,
      surveys: undefined,
    };

    if (data.surveys) {
      updatedInput = {
        ...data,
        surveys: {
          connect: data.surveys.map((surveyId) => ({ id: surveyId })),
        },
      };
    }

    const currentSegment = await getSegment(segmentId);
    if (!currentSegment) {
      throw new ResourceNotFoundError("segment", segmentId);
    }

    assertPrivateSegmentKeepsTitle(data, currentSegment);
    if (needsSurveyIdTitleCheck(data, currentSegment)) {
      await assertTitleIsNotSurveyId(
        currentSegment.directoryId,
        currentSegment.workspaceId,
        data.title ?? currentSegment.title
      );
    }

    const segment = await prisma.segment.update({
      where: {
        id: segmentId,
      },
      data: updatedInput,
      select: selectSegment,
    });

    return transformPrismaSegment(segment);
  } catch (error) {
    throwSegmentTitleTaken(error);
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      throw new DatabaseError(error.message);
    }

    throw error;
  }
};

export const getSegmentsByAttributeKey = reactCache(async (workspaceId: string, attributeKey: string) => {
  validateInputs([workspaceId, ZId], [attributeKey, ZString]);

  try {
    const directory = await getWorkspaceContactDirectory(workspaceId);
    if (!directory) return [];

    const segments = await prisma.segment.findMany({
      where: whereSegmentsOfWorkspace(workspaceId, directory.id),
      select: selectSegment,
    });

    // search for contactAttributeKey in the filters
    const clonedSegments = structuredClone(segments);

    const filteredSegments = clonedSegments.filter((segment) => {
      return searchForAttributeKeyInSegment(segment.filters, attributeKey);
    });

    return filteredSegments;
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      throw new DatabaseError(error.message);
    }

    throw error;
  }
});
