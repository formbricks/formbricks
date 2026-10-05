import { type TCustomCssScope } from "@formbricks/types/custom-css";
import { getCustomCssByteLimit } from "./draft";

/** What the file picker offers. The type check below is what decides; this only filters the dialog. */
export const CUSTOM_CSS_FILE_ACCEPT = ".css,text/css";

export type TCustomCssFileCheck = { ok: true } | { ok: false; reason: "type" | "size" };

/**
 * A `.css` file within the scope's byte budget. Browsers report an empty MIME type for `.css` on some
 * systems, so the extension is required and the MIME type only has to not contradict it. The size
 * check uses the file's own byte size, which is its UTF-8 length; the combined budget across both
 * fields is checked by the counter once the file is in the field.
 */
export const checkCustomCssFile = (
  file: Pick<File, "name" | "type" | "size">,
  scope: TCustomCssScope
): TCustomCssFileCheck => {
  const hasCssExtension = file.name.toLowerCase().endsWith(".css");
  const hasCssType = file.type === "" || file.type === "text/css";
  if (!hasCssExtension || !hasCssType) return { ok: false, reason: "type" };
  if (file.size > getCustomCssByteLimit(scope)) return { ok: false, reason: "size" };
  return { ok: true };
};

/** File text without a leading byte-order mark, which would otherwise count as three bytes of CSS. */
export const stripByteOrderMark = (text: string): string => (text.startsWith("﻿") ? text.slice(1) : text);
