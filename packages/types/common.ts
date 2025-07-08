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

  // Allow localhost for easy recall testing on self-hosted environments
  if (!url.startsWith("https://") && !url.startsWith("http://localhost")) {
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
        message: "Recall information must appear after the domain, not within it",
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

      // Check if it's localhost (allow for easy recall testing on self-hosted environments)
      if (hostname === "localhost") {
        return; // localhost is valid
      }

      // Check if it's an IPv6 address (simplified check for bracket notation)
      if (hostname.startsWith("[") && hostname.endsWith("]")) {
        const ipv6 = hostname.slice(1, -1);
        // Basic IPv6 validation - common cases like ::1, ::, and basic hex:hex format
        if (ipv6 === "::1" || ipv6 === "::" || /^[0-9a-fA-F:]+$/.test(ipv6)) {
          return; // IPv6 address is valid
        }
      }

      // For regular domain names, require proper structure
      if (!hostname.includes(".")) {
        addIssue();
        return;
      }

      const parts = hostname.split(".");

      // Check if it's an IPv4 address
      // Simple IPv4 validation instead of complex regex
      if (
        parts.length === 4 &&
        parts.every((part) => {
          const num = parseInt(part, 10);
          return !isNaN(num) && num >= 0 && num <= 255 && part === num.toString();
        })
      ) {
        return; // IPv4 address is valid
      }

      // Check if it has a valid top-level domain (at least 2 characters after the last dot, for example: .com, .uk, .de, etc.)
      const tld = parts[parts.length - 1];

      // TLD validation: must be at least 2 characters and contain valid domain characters
      // Support punycode TLDs (IDNs) which can contain hyphens and numbers
      // DNS label limit is 63 characters, but most TLDs are much shorter
      if (
        tld.length < 2 ||
        tld.length > 63 ||
        !/^[a-zA-Z0-9-]+$/.test(tld) ||
        tld.startsWith("-") ||
        tld.endsWith("-")
      ) {
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
  } catch {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "URL is not valid",
    });
  }
};
