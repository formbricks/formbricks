import type { FormatContext } from "../../shared/format";

/** The host's locale and zone with the defaults filled in, for code that needs both as strings. */
export type Display = Required<FormatContext>;

export const formatDuration = (seconds: number): string => {
  const whole = Math.max(0, Math.round(seconds));
  if (whole < 60) return `${whole}s`;
  const minutes = Math.floor(whole / 60);
  const rest = whole % 60;
  if (minutes < 60) return rest === 0 ? `${minutes}m` : `${minutes}m ${rest}s`;
  const hours = Math.floor(minutes / 60);
  return `${hours}h ${minutes % 60}m`;
};

/** Human label for the element types the table shows under a header. */
const TYPE_LABELS: Record<string, string> = {
  openText: "Free text",
  multipleChoiceSingle: "Single choice",
  multipleChoiceMulti: "Multiple choice",
  nps: "NPS",
  rating: "Rating",
  csat: "CSAT",
  ces: "CES",
  consent: "Consent",
  pictureSelection: "Picture choice",
  cta: "Call to action",
  date: "Date",
  fileUpload: "File upload",
  cal: "Booking",
  matrix: "Matrix",
  address: "Address",
  ranking: "Ranking",
  contactInfo: "Contact info",
};

export const typeLabel = (type: string): string => TYPE_LABELS[type] ?? "Question";
