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

export const getZSafeUrl = z.string().superRefine((url, ctx) => {
  safeUrlRefinement(url, ctx);
});

export const safeUrlRefinement = (url: string, ctx: z.RefinementCtx): void => {
  if (url.includes(" ") || url.endsWith(" ") || url.startsWith(" ")) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "URL must not contain spaces",
    });
  }

  // early recall check for better user feedback
  if (url.startsWith("#recall:")) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "URL must not start with a recall value",
    });
  }

  if (!url.startsWith("https://")) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "URL must start with https://",
    });
  }

  try {
    const urlObj = new URL(url);
    const hostname = urlObj.hostname;

    // Check if recall information appears in the hostname (not allowed)
    if (hostname.includes("#recall:")) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Recall value is not allowed in the hostname",
      });
      return;
    }

    // Validate domain structure
    if (hostname) {
      const addIssue = (): void => {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "URL is not valid",
        });
      };

      // Check if hostname contains at least one dot (for top-level domain, for example: formbricks.com)
      if (!hostname.includes(".")) {
        addIssue();
      } else {
        // Check if it has a valid top-level domain (at least 2 characters after the last dot, for example: .com, .uk, .de, etc.)
        const parts = hostname.split(".");
        const tld = parts[parts.length - 1];

        // TLD validation: must be at least 2 characters and contain only letters
        // Also limit length to 6 chars to catch fake long TLDs
        if (tld.length < 2 || tld.length > 6 || !/^[a-zA-Z]+$/.test(tld)) {
          addIssue();
          return;
        }

        // Special case: if we have www.something, ensure "something" is not just a single part
        // www.domain should be www.domain.tld (at least 3 parts total)
        if (parts[0].toLowerCase() === "www" && parts.length < 3) {
          addIssue();
          return;
        }

        // Check if all parts are valid (no empty parts between dots)
        if (parts.some((part) => part.length === 0)) {
          addIssue();
          return;
        }

        // Ensure we have at least a domain name + TLD (minimum 2 parts)
        if (parts.length < 2) {
          addIssue();
          return;
        }

        // Validate each part contains only valid domain characters
        const domainRegex = /^[a-zA-Z0-9-]+$/;
        for (const part of parts) {
          if (!domainRegex.test(part) || part.startsWith("-") || part.endsWith("-")) {
            addIssue();
            return;
          }
        }
      }
    }
  } catch {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "URL is not valid",
    });
  }
};
