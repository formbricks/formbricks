import { z } from "zod";
import {
  CONTACT_DIRECTORY_NAME_MAX_LENGTH,
  CONTACT_DIRECTORY_WORKSPACES_MAX,
} from "@/modules/ee/contacts/directories/lib/constants";
import { CONTACT_DIRECTORY_MATCHING_KEYS } from "@/modules/ee/contacts/directories/types";

export const ZContactDirectoriesQuery = z.object({ organizationId: z.cuid2() }).strict();

export type TContactDirectoriesQuery = z.infer<typeof ZContactDirectoriesQuery>;

export const ZContactDirectoryParams = z.object({ directoryId: z.cuid2() }).strict();

/** The `[directoryId]` routes take no query: the organization comes from the directory. */
export const ZContactDirectoryQuery = z.object({}).strict();

/** Every directory has a name (spec decision 2). The service trims it and refuses a blank one (422). */
const ZDirectoryName = z
  .string()
  .max(CONTACT_DIRECTORY_NAME_MAX_LENGTH)
  .refine((name) => !name.includes("\u0000"), { message: "Must not contain NUL characters." });

const ZWorkspaceIdList = z.array(z.cuid2()).max(CONTACT_DIRECTORY_WORKSPACES_MAX);
const ZWorkspaceIds = ZWorkspaceIdList.min(1);

/** A name and at least one workspace (spec decisions 2 and 21): a directory is never created empty. */
export const ZContactDirectoryCreateBody = z
  .object({
    name: ZDirectoryName,
    matchingKey: z.enum(CONTACT_DIRECTORY_MATCHING_KEYS),
    workspaceIds: ZWorkspaceIds,
  })
  .strict();

export type TContactDirectoryCreateBody = z.infer<typeof ZContactDirectoryCreateBody>;

/**
 * `matchingKey` is not accepted (strict), because it never changes after creation (spec decision 1). A name
 * left out stays as it is. `workspaceIds` is the directory's full list: leaving a workspace out removes it,
 * and an empty list removes every workspace, which leaves the directory active (ADR 0062). `isArchived: true`
 * archives a directory left with no workspaces; `false` unarchives one, with or without new workspaces; the
 * service enforces both. `pauseSurveysInWorkspaceIds` names removed workspaces whose targeted surveys get paused.
 */
export const ZContactDirectoryUpdateBody = z
  .object({
    name: ZDirectoryName.optional(),
    workspaceIds: ZWorkspaceIdList.optional(),
    isArchived: z.boolean().optional(),
    pauseSurveysInWorkspaceIds: ZWorkspaceIdList.optional(),
  })
  .strict()
  .refine(
    (body) => body.name !== undefined || body.workspaceIds !== undefined || body.isArchived !== undefined,
    { message: "Send a name, workspaceIds or isArchived." }
  );

export type TContactDirectoryUpdateBody = z.infer<typeof ZContactDirectoryUpdateBody>;
