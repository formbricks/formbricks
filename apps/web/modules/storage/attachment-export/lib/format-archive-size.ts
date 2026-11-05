const BYTES_PER_MB = 1024 * 1024;
const BYTES_PER_GB = 1024 * BYTES_PER_MB;

/** "812 MB", "3.4 GB" — sizes the user compares against their connection, so one decimal is enough. */
export const formatArchiveSize = (bytes: number, locale: string): string => {
  const [value, unit] =
    bytes >= BYTES_PER_GB ? [bytes / BYTES_PER_GB, "gigabyte"] : [bytes / BYTES_PER_MB, "megabyte"];
  return new Intl.NumberFormat(locale, {
    style: "unit",
    unit,
    unitDisplay: "short",
    maximumFractionDigits: value < 10 ? 1 : 0,
  }).format(value);
};
