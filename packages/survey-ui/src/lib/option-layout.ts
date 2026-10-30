/** How a list of choices is laid out: stacked, or side by side. */
export type TOptionLayout = "list" | "row";

/**
 * Classes for the element that holds a choice list. "row" lays short choices side by side and wraps
 * when they do not fit. Each option is fit-content wide: an ordinary label moves to the next line
 * rather than breaking mid-word, but `overflow-wrap: anywhere` caps an option at the row's width,
 * so a label with no break opportunity (a long URL) breaks where it must instead of being clipped.
 * Regular options are `<label>`s; the "Other" box is the only `<div>` child and takes a full line,
 * so its text field opens with room to type.
 */
export const getOptionGroupClassName = (layout: TOptionLayout): string =>
  layout === "row"
    ? "flex flex-wrap gap-2 *:min-w-fit *:flex-1 *:[overflow-wrap:anywhere] [&>div]:basis-full"
    : "space-y-2";

/** The layout of a list-style display variant; a dropdown never reaches the list renderer. */
export const getOptionLayout = (variant: "list" | "row" | "dropdown"): TOptionLayout =>
  variant === "row" ? "row" : "list";
