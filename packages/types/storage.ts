import { z } from "zod";

export const ZAllowedFileExtension = z.enum([
  "heic",
  "png",
  "jpeg",
  "jpg",
  "webp",
  "pdf",
  "eml",
  "doc",
  "docx",
  "xls",
  "xlsx",
  "ppt",
  "pptx",
  "txt",
  "csv",
  "mp4",
  "mov",
  "avi",
  "mkv",
  "webm",
  "zip",
  "rar",
  "7z",
  "tar",
]);

export const mimeTypes: Record<TAllowedFileExtension, string> = {
  heic: "image/heic",
  png: "image/png",
  jpeg: "image/jpeg",
  jpg: "image/jpeg",
  webp: "image/webp",
  pdf: "application/pdf",
  eml: "message/rfc822",
  doc: "application/msword",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xls: "application/vnd.ms-excel",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ppt: "application/vnd.ms-powerpoint",
  pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  txt: "text/plain",
  csv: "text/csv",
  mp4: "video/mp4",
  mov: "video/quicktime",
  avi: "video/x-msvideo",
  mkv: "video/x-matroska",
  webm: "video/webm",
  zip: "application/zip",
  rar: "application/vnd.rar",
  "7z": "application/x-7z-compressed",
  tar: "application/x-tar",
};

export type TAllowedFileExtension = z.infer<typeof ZAllowedFileExtension>;

export const ZAccessType = z.enum(["public", "private"]);
export type TAccessType = z.infer<typeof ZAccessType>;

export const ZDownloadFileRequest = z.object({
  fileName: z
    .string()
    .trim()
    .min(1)
    .refine(
      (fn) => {
        const fileExtension = fn.split(".").pop() as TAllowedFileExtension | undefined;
        if (!fileExtension || fileExtension.toLowerCase() === fn.toLowerCase()) {
          return false;
        }

        return true;
      },
      {
        message: "File name must have an extension",
      }
    ),
  environmentId: z.string().cuid2(),
  accessType: ZAccessType,
});

export const ZDeleteFileRequest = ZDownloadFileRequest;

export const ZUploadFileConfig = z.object({
  allowedFileExtensions: z.array(z.string()).optional(),
  surveyId: z.string().optional(),
});

export type TUploadFileConfig = z.infer<typeof ZUploadFileConfig>;

export const ZUploadPrivateFileRequest = z
  .object({
    fileName: z.string().trim().min(1),
    fileType: z.string().trim().min(1),
    allowedFileExtensions: z.array(ZAllowedFileExtension).optional(),
    surveyId: z.string().cuid2(),
    environmentId: z.string().cuid2(),
  })
  .superRefine((data, ctx) => {
    refineFileUploadInput({
      data: {
        fileName: data.fileName,
        fileType: data.fileType,
        allowedFileExtensions: data.allowedFileExtensions,
      },
      ctx,
    });
  });

export type TUploadPrivateFileRequest = z.infer<typeof ZUploadPrivateFileRequest>;

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

export const ZUploadPublicFileRequest = z
  .object({
    fileName: z.string().trim().min(1),
    fileType: z.string().trim().min(1),
    environmentId: z.string().cuid2(),
    allowedFileExtensions: z.array(ZAllowedFileExtension).optional(),
  })
  .superRefine((data, ctx) => {
    refineFileUploadInput({
      data: {
        fileName: data.fileName,
        fileType: data.fileType,
        allowedFileExtensions: data.allowedFileExtensions,
      },
      ctx,
    });
  });

export type TUploadPublicFileRequest = z.infer<typeof ZUploadPublicFileRequest>;

const refineFileUploadInput = ({
  data,
  ctx,
}: {
  data: {
    fileName: string;
    fileType: string;
    allowedFileExtensions?: TAllowedFileExtension[];
  };
  ctx: z.RefinementCtx;
}): void => {
  const fileExtension = data.fileName.split(".").pop()?.toLowerCase() as TAllowedFileExtension | undefined;

  if (!fileExtension || fileExtension.toLowerCase() === data.fileName.toLowerCase()) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "File name must have an extension",
      path: ["fileName"],
    });

    return;
  }

  const { success } = ZAllowedFileExtension.safeParse(fileExtension);

  if (!success) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "File extension is not allowed for security reasons",
      path: ["fileName"],
    });

    return;
  }

  const normalizedFileType = data.fileType.toLowerCase().split(";")[0]; // removes parameters from fileType like "image/jpeg; charset=binary"
  if (normalizedFileType !== mimeTypes[fileExtension]) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "File type doesn't match the file extension",
      path: ["fileType"],
    });

    return;
  }

  if (data.allowedFileExtensions?.length) {
    if (!data.allowedFileExtensions.includes(fileExtension)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `File extension is not allowed, allowed extensions are: ${data.allowedFileExtensions.join(", ")}`,
        path: ["fileName"],
      });
    }
  }
};
