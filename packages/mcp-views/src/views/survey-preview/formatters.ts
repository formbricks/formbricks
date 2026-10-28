import { type FormatContext, formatDateTime, formatNumber } from "../../shared/format";
import type { Formatters } from "./outline";

/** The outline's dates and numbers in the host's locale and time zone, through the shared formatters. */
export const createFormatters = (context: FormatContext): Formatters => ({
  date: (iso) => formatDateTime(iso, context),
  number: (value) => formatNumber(value, context),
});
