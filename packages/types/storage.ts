import { z } from "zod";

export const ZAccessType = z.enum(["public", "private"]);
export type TAccessType = z.infer<typeof ZAccessType>;

export const ZStorageRetrievalParams = z.object({
  fileName: z.string(),
  environmentId: z.string().cuid2(),
  accessType: ZAccessType,
});

export const ZUploadFileConfig = z.object({
  allowedFileExtensions: z.array(z.string()).optional(),
  surveyId: z.string().optional(),
});

export type TUploadFileConfig = z.infer<typeof ZUploadFileConfig>;

export const ZUploadFileRequest = z.object({
  fileName: z.string(),
  fileType: z.string(),
  surveyId: z.string().cuid2(),
  environmentId: z.string().cuid2(),
});

export type TUploadFileRequest = z.infer<typeof ZUploadFileRequest>;

export const ZUploadFileResponse = z.object({
  data: z.object({
    signedUrl: z.string(),
    fileUrl: z.string(),
    signingData: z
      .object({
        signature: z.string(),
        timestamp: z.number(),
        uuid: z.string(),
      })
      .nullable(),
    presignedFields: z.record(z.string()).optional(),
    updatedFileName: z.string(),
  }),
});

export type TUploadFileResponse = z.infer<typeof ZUploadFileResponse>;
