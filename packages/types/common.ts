import { z } from "zod";

export const ZBoolean = z.boolean();

export const ZString = z.string();

export const ZNumber = z.number();

export const ZOptionalNumber = z.number().optional();

export const ZOptionalString = z.string().optional();

export const ZNullableString = z.string().nullable();

export const ZColor = z.string().regex(/^#(?:[A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/);

export const ZPlacement = z.enum(["bottomLeft", "bottomRight", "topLeft", "topRight", "center"]);

export type TPlacement = z.infer<typeof ZPlacement>;

export const ZAllowedFileExtension = z.enum([
  "heic",
  "png",
  "jpeg",
  "jpg",
  "webp",
  "pdf",
  "doc",
  "docx",
  "xls",
  "xlsx",
  "ppt",
  "pptx",
  "plain",
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
  doc: "application/msword",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xls: "application/vnd.ms-excel",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ppt: "application/vnd.ms-powerpoint",
  pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  plain: "text/plain",
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

export const ZId = z.string().cuid2();

export const ZUuid = z.string().uuid();

export const getZSafeUrl = (message: string): z.ZodEffects<z.ZodString, string, string> =>
  z
    .string()
    .url({ message })
    .superRefine((url, ctx) => {
      if (url.includes(" ")) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "URL must not contain spaces",
        });
      }

      if (!url.startsWith("https://")) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "URL must start with https://",
        });
      }
    });
