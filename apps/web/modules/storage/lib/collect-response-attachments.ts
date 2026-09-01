import "server-only";
import { prisma } from "@formbricks/database";
import type { Prisma } from "@formbricks/database/prisma";
import { logger } from "@formbricks/logger";
import type { TI18nString } from "@formbricks/types/i18n";
import type { TResponseFilterCriteria } from "@formbricks/types/responses";
import type { TAccessType } from "@formbricks/types/storage";
import type { TSurvey } from "@formbricks/types/surveys/types";
import { getTextContent } from "@formbricks/types/surveys/validation";
import { getLocalizedValue } from "@/lib/i18n/utils";
import { buildWhereClause } from "@/lib/response/where-clause";
import { replaceHeadlineRecall } from "@/lib/utils/recall";
import { findWorkspaceByIdOrLegacyEnvId } from "@/lib/utils/resolve-client-id";
import { buildAttachmentZipPath } from "@/modules/storage/lib/attachment-zip-paths";
import { getOriginalFileNameFromUrl } from "@/modules/storage/url-helpers";
import { getSurveyFileUploadConfigs, parseStorageFileUrl } from "@/modules/storage/utils";
import { getElementsFromBlocks } from "@/modules/survey/lib/client-utils";

/**
 * Collects the file-upload attachments of a survey's responses, ready to be streamed into a ZIP
 * (ENG-1256). Deliberately metadata-only: it never opens a storage stream, so the route can call it
 * first to pre-flight a count and decide whether to start the download at all.
 *
 * ## Why this does not call `getResponses`
 *
 * `getResponses` hydrates tags, contact and quota joins for every response, and
 * `getResponseDownloadFile` shows where that leads — it loops it until the survey is exhausted and holds
 * every fully-hydrated response in memory. An attachment export only needs `id`, `createdAt` and `data`,
 * so it runs its own lean select over the same `buildWhereClause` the CSV export filters with.
 *
 * ## Why every URL's workspace is re-resolved
 *
 * The file URLs come out of `response.data`, i.e. from whoever wrote the response, and the storage key
 * is built from the id in the *URL* rather than from the survey's workspace. Write-time validation
 * (`validateClientFileUploads`) only inspects keys that match a file-upload element existing *at write
 * time*, so a caller can plant a foreign URL under a key that is not yet an element and then edit the
 * survey to turn that key into a file-upload element — a time-of-check/time-of-use gap that makes the
 * planted URL look like a real answer here. `delete-response-files.ts` documents the same gap on the
 * delete side; read its header before changing this. The read side cannot trust the URL's id either, so
 * each one is resolved through `findWorkspaceByIdOrLegacyEnvId` and anything outside the survey's
 * workspace is dropped and reported rather than silently omitted.
 */

export type TAttachmentStatus =
  | "ok"
  | "skipped_foreign_workspace"
  | "skipped_invalid_url"
  // Set by the streaming stage, not the collector: the object was gone when the archive asked for it.
  | "missing_in_storage";

export interface TAttachmentEntry {
  /** Path inside the archive. Unique across the whole export. */
  zipPath: string;
  responseId: string;
  responseCreatedAt: Date;
  elementId: string;
  elementLabel: string;
  originalFileName: string;
  status: TAttachmentStatus;
  /** Filled in by the streaming stage once storage reports the object's size. */
  bytes?: number;
  /** Set only when `status` is `ok` — the coordinates `getFileStreamForDownload` needs. */
  storage?: {
    storageId: string;
    accessType: TAccessType;
    /** Decoded: the object is stored under the decoded name, the URL carries it percent-encoded. */
    fileName: string;
  };
}

export interface CollectResponseAttachmentsParams {
  survey: TSurvey;
  filterCriteria?: TResponseFilterCriteria;
  /**
   * Stop after this many downloadable files. The collector reads one past the limit so the caller can
   * tell "exactly at the cap" from "over the cap" and refuse before any bytes are written.
   */
  maxFiles: number;
  /** Responses fetched per query. */
  batchSize?: number;
}

export interface CollectResponseAttachmentsResult {
  entries: TAttachmentEntry[];
  /** Entries with `status: "ok"` — what the archive will actually contain. */
  fileCount: number;
  /** Responses that contributed at least one attachment. */
  responseCount: number;
  /** True when the survey holds more downloadable files than `maxFiles`. */
  exceedsMaxFiles: boolean;
}

const DEFAULT_BATCH_SIZE = 500;

interface LabelledElement {
  /** 1-based position in the survey, so ZIP folders sort in survey order. */
  index: number;
  label: string;
}

/**
 * Maps each file-upload element id to its survey position and display label.
 *
 * The label recipe matches `extractSurveyDetails`, so a ZIP folder and its CSV column read the same.
 * A survey holds its elements in `blocks` or in legacy `questions` — never both (`ZSurvey` rejects
 * that) — but `getSurveyFileUploadConfigs` covers both shapes, so this does too. `replaceHeadlineRecall`
 * only rewrites block headlines; a legacy questions-only survey keeps its raw recall tokens in the
 * folder name, which is the same thing the CSV export does.
 */
const buildFileUploadElementLabels = (survey: TSurvey): Map<string, LabelledElement> => {
  const surveyWithRecall = replaceHeadlineRecall(survey, "default");

  const orderedElements: { id: string; headline?: TI18nString }[] = surveyWithRecall.blocks?.length
    ? getElementsFromBlocks(surveyWithRecall.blocks)
    : (surveyWithRecall.questions ?? []);

  const fileUploadIds = new Set(
    getSurveyFileUploadConfigs({
      blocks: surveyWithRecall.blocks,
      questions: surveyWithRecall.questions,
    }).map((config) => config.id)
  );

  const labels = new Map<string, LabelledElement>();

  orderedElements.forEach((element, position) => {
    if (!fileUploadIds.has(element.id)) return;

    const headline = getTextContent(getLocalizedValue(element.headline, "default"));

    labels.set(element.id, { index: position + 1, label: headline || element.id });
  });

  return labels;
};

/** Cached per distinct storage id: several files in one response normally share one. */
const createWorkspaceResolver = () => {
  const pending = new Map<string, ReturnType<typeof findWorkspaceByIdOrLegacyEnvId>>();

  return (storageId: string) => {
    const cached = pending.get(storageId);
    if (cached) return cached;

    const lookup = findWorkspaceByIdOrLegacyEnvId(storageId);
    pending.set(storageId, lookup);
    return lookup;
  };
};

const extractFileUrls = (value: unknown): string[] =>
  Array.isArray(value) ? value.filter((entry): entry is string => typeof entry === "string") : [];

/**
 * The URL carries the percent-encoded name; the object is stored under the decoded one. Returns null
 * on malformed encoding (a bare `%`) instead of throwing: `decodeURIComponent` raises `URIError`, and
 * response data is attacker-supplied, so one bad answer would abort the whole export.
 */
const decodeStoredFileName = (fileName: string): string | null => {
  try {
    return decodeURIComponent(fileName);
  } catch {
    return null;
  }
};

export const collectResponseAttachments = async ({
  survey,
  filterCriteria,
  maxFiles,
  batchSize = DEFAULT_BATCH_SIZE,
}: CollectResponseAttachmentsParams): Promise<CollectResponseAttachmentsResult> => {
  const elementLabels = buildFileUploadElementLabels(survey);

  if (elementLabels.size === 0) {
    return { entries: [], fileCount: 0, responseCount: 0, exceedsMaxFiles: false };
  }

  const where: Prisma.ResponseWhereInput = {
    surveyId: survey.id,
    ...buildWhereClause(survey, filterCriteria),
  };

  const resolveWorkspace = createWorkspaceResolver();
  const usedPaths = new Set<string>();
  const entries: TAttachmentEntry[] = [];

  let fileCount = 0;
  let responseCount = 0;
  let exceedsMaxFiles = false;
  let cursor: string | undefined;

  while (!exceedsMaxFiles) {
    const responses = await prisma.response.findMany({
      where,
      select: { id: true, createdAt: true, data: true },
      // Any stable total order works; Prisma's own cursor keeps the batches consistent with it.
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: batchSize,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    });

    if (responses.length === 0) break;

    for (const response of responses) {
      let responseContributed = false;

      for (const [elementId, element] of elementLabels) {
        const fileUrls = extractFileUrls((response.data as Record<string, unknown>)[elementId]);

        for (const fileUrl of fileUrls) {
          const storageFile = parseStorageFileUrl(fileUrl);
          const originalFileName = getOriginalFileNameFromUrl(fileUrl);

          const base = {
            responseId: response.id,
            responseCreatedAt: response.createdAt,
            elementId,
            elementLabel: element.label,
            originalFileName,
          };

          if (!storageFile) {
            logger.warn(
              { responseId: response.id, elementId },
              "Skipping an attachment with an unparseable storage URL"
            );
            entries.push({ ...base, zipPath: "", status: "skipped_invalid_url" });
            continue;
          }

          const storageWorkspace = await resolveWorkspace(storageFile.storageId);
          if (storageWorkspace?.id !== survey.workspaceId) {
            logger.error(
              {
                responseId: response.id,
                elementId,
                storageId: storageFile.storageId,
                surveyWorkspaceId: survey.workspaceId,
              },
              "Refusing to export a response file stored outside the survey's workspace"
            );
            entries.push({ ...base, zipPath: "", status: "skipped_foreign_workspace" });
            continue;
          }

          const storedFileName = decodeStoredFileName(storageFile.fileName);
          if (storedFileName === null) {
            logger.warn(
              { responseId: response.id, elementId },
              "Skipping an attachment whose storage URL has malformed percent-encoding"
            );
            entries.push({ ...base, zipPath: "", status: "skipped_invalid_url" });
            continue;
          }

          if (fileCount >= maxFiles) {
            exceedsMaxFiles = true;
            break;
          }

          entries.push({
            ...base,
            zipPath: buildAttachmentZipPath({
              responseId: response.id,
              responseCreatedAt: response.createdAt,
              elementIndex: element.index,
              elementLabel: element.label,
              originalFileName,
              usedPaths,
            }),
            status: "ok",
            storage: {
              storageId: storageFile.storageId,
              accessType: storageFile.accessType,
              fileName: storedFileName,
            },
          });

          fileCount++;
          responseContributed = true;
        }

        if (exceedsMaxFiles) break;
      }

      if (responseContributed) responseCount++;
      if (exceedsMaxFiles) break;
    }

    if (responses.length < batchSize) break;
    cursor = responses[responses.length - 1].id;
  }

  return { entries, fileCount, responseCount, exceedsMaxFiles };
};
