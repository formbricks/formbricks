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

/** Null or blank means "no name"; the service trims it. Whether one is required is a rule (422), not a shape. */
const ZDirectoryName = z
  .string()
  .max(CONTACT_DIRECTORY_NAME_MAX_LENGTH)
  .refine((name) => !name.includes("\u0000"), { message: "Must not contain NUL characters." })
  .nullable();

const ZWorkspaceIds = z.array(z.cuid2()).min(1).max(CONTACT_DIRECTORY_WORKSPACES_MAX);

/** At least one workspace (spec decision 21): a directory is never created empty. */
export const ZContactDirectoryCreateBody = z
  .object({
    name: ZDirectoryName.optional(),
    matchingKey: z.enum(CONTACT_DIRECTORY_MATCHING_KEYS),
    workspaceIds: ZWorkspaceIds,
  })
  .strict();

export type TContactDirectoryCreateBody = z.infer<typeof ZContactDirectoryCreateBody>;

/**
 * Name and workspaces only. `matchingKey` is not accepted (strict), because it never changes after creation
 * (spec decision 1). `workspaceIds` is the directory's full list.
 */
export const ZContactDirectoryUpdateBody = z
  .object({
    name: ZDirectoryName.optional(),
    workspaceIds: ZWorkspaceIds.optional(),
  })
  .strict()
  .refine((body) => body.name !== undefined || body.workspaceIds !== undefined, {
    message: "Send a name, workspaceIds or both.",
  });

export type TContactDirectoryUpdateBody = z.infer<typeof ZContactDirectoryUpdateBody>;
