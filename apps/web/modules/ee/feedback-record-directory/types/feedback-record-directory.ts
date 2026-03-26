import { z } from "zod";
import { ZId } from "@formbricks/types/common";

export const ZFeedbackRecordDirectory = z.object({
  id: ZId,
  name: z.string(),
  isArchived: z.boolean(),
  projectCount: z.number(),
});

export type TFeedbackRecordDirectory = z.infer<typeof ZFeedbackRecordDirectory>;

export const ZFeedbackRecordDirectoryDetails = z.object({
  id: ZId,
  name: z.string(),
  isArchived: z.boolean(),
  organizationId: ZId,
  projects: z.array(
    z.object({
      projectId: ZId,
      projectName: z.string(),
    })
  ),
});

export type TFeedbackRecordDirectoryDetails = z.infer<typeof ZFeedbackRecordDirectoryDetails>;

export const ZFeedbackRecordDirectoryCreateInput = z.object({
  name: z.string().trim().min(1, "Directory name is required"),
});

export type TFeedbackRecordDirectoryCreateInput = z.infer<typeof ZFeedbackRecordDirectoryCreateInput>;

export const ZFeedbackRecordDirectoryUpdateInput = z.object({
  name: z.string().trim().min(1, "Directory name must be at least 1 character long").optional(),
  projectIds: z.array(ZId).optional(),
  isArchived: z.boolean().optional(),
});

export type TFeedbackRecordDirectoryUpdateInput = z.infer<typeof ZFeedbackRecordDirectoryUpdateInput>;
