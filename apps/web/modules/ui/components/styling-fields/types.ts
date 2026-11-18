import type { FieldPathByValue, UseFormReturn } from "react-hook-form";
import type { TSurveyStyling } from "@formbricks/types/surveys/types";
import type { TWorkspaceStyling } from "@formbricks/types/workspace";

type TStylingValues = TWorkspaceStyling | TSurveyStyling;

/** The styling form the fields bind to: a workspace's Look & Feel or a survey's Styling tab. */
export type TStylingForm = UseFormReturn<TStylingValues>;

/** A field of that form holding a `TValue`, such as `brandColor.light` or `inputHeight`. */
export type TStylingFieldPath<TValue> = FieldPathByValue<TStylingValues, TValue>;
