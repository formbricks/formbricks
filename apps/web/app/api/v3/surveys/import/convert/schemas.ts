import { z } from "zod";
import type { TV3MultipartBody } from "@/app/api/v3/lib/api-wrapper";
import { IMPORT_MAX_FILE_BYTES } from "@/modules/survey/import/types";

/** 15 MB file plus 1 MB of multipart framing slack (D3). */
export const IMPORT_CONVERT_BODY_LIMIT_BYTES = IMPORT_MAX_FILE_BYTES + 1024 * 1024;

const ZMultipartFile = z.object({
  name: z.string(),
  fileName: z.string(),
  mimeType: z.string(),
  bytes: z.instanceof(Buffer),
});

/**
 * The multipart body as the wrapper hands it over: `workspaceId` (+ optional `type`, `language`) as
 * fields and exactly one `file` part. Anything else is a 400 at the door.
 */
export const ZV3SurveyImportConvertBody = z
  .object({
    fields: z
      .object({
        workspaceId: z.cuid2(),
        type: z.enum(["link", "app"]).optional(),
        language: z.string().trim().min(2).max(35).optional(),
      })
      .strict(),
    files: z
      .array(ZMultipartFile)
      .min(1, "A 'file' part is required")
      .max(1, "Send exactly one file")
      .refine((files) => files.every((file) => file.name === "file"), {
        message: "The file part must be named 'file'",
      }),
  })
  .strict() satisfies z.ZodType<unknown, TV3MultipartBody>;

export type TV3SurveyImportConvertBody = z.infer<typeof ZV3SurveyImportConvertBody>;
