import { TSurveyElementTypeEnum } from "@formbricks/types/surveys/elements";
import type {
  TSurveyElementSummaryAddress,
  TSurveyElementSummaryContactInfo,
  TSurveyElementSummaryDate,
  TSurveyElementSummaryFileUpload,
  TSurveyElementSummaryHiddenFields,
  TSurveyElementSummaryOpenText,
  TSurveyElementSummarySignature,
  TSurveySummary,
} from "@formbricks/types/surveys/types";

/**
 * The survey summary as the Summary page renders it: its metadata, drop-offs, quotas and one card per
 * element. It is a view computed from the responses, not a stored row, so it travels as computed. The only
 * timestamps in it are the `updatedAt` of the sample answers some cards list; they travel as ISO strings
 * and the page's API client revives them.
 */

type TSurveySummaryItem = TSurveySummary["summary"][number];

/** A sample answer with its `updatedAt` as an ISO string. */
type TJsonSample<T extends { updatedAt: Date }> = Omit<T, "updatedAt"> & { updatedAt: string };

/** An element card whose `K` list carries timestamps, with them as ISO strings. */
type TJsonSamples<T, K extends keyof T> = Omit<T, K> & {
  [P in K]: T[P] extends (infer E extends { updatedAt: Date })[] ? TJsonSample<E>[] : T[P];
};

type TTimestampedSummaryItem =
  | TSurveyElementSummaryOpenText
  | TSurveyElementSummaryDate
  | TSurveyElementSummaryAddress
  | TSurveyElementSummaryContactInfo
  | TSurveyElementSummaryHiddenFields
  | TSurveyElementSummaryFileUpload
  | TSurveyElementSummarySignature;

export type TSurveySummaryItemResource =
  | TJsonSamples<TSurveyElementSummaryOpenText, "samples">
  | TJsonSamples<TSurveyElementSummaryDate, "samples">
  | TJsonSamples<TSurveyElementSummaryAddress, "samples">
  | TJsonSamples<TSurveyElementSummaryContactInfo, "samples">
  | TJsonSamples<TSurveyElementSummaryHiddenFields, "samples">
  | TJsonSamples<TSurveyElementSummaryFileUpload, "files">
  | TJsonSamples<TSurveyElementSummarySignature, "signatures">
  | Exclude<TSurveySummaryItem, TTimestampedSummaryItem>;

export type TSurveySummaryResource = Omit<TSurveySummary, "summary"> & {
  summary: TSurveySummaryItemResource[];
};

const toJsonSample = <T extends { updatedAt: Date }>({ updatedAt, ...sample }: T): TJsonSample<T> => ({
  ...sample,
  updatedAt: updatedAt.toISOString(),
});

const serializeSummaryItem = (item: TSurveySummaryItem): TSurveySummaryItemResource => {
  switch (item.type) {
    case TSurveyElementTypeEnum.OpenText:
      return { ...item, samples: item.samples.map(toJsonSample) };
    case TSurveyElementTypeEnum.Date:
      return { ...item, samples: item.samples.map(toJsonSample) };
    case TSurveyElementTypeEnum.Address:
      return { ...item, samples: item.samples.map(toJsonSample) };
    case TSurveyElementTypeEnum.ContactInfo:
      return { ...item, samples: item.samples.map(toJsonSample) };
    case "hiddenField":
      return { ...item, samples: item.samples.map(toJsonSample) };
    case TSurveyElementTypeEnum.FileUpload:
      return { ...item, files: item.files.map(toJsonSample) };
    case TSurveyElementTypeEnum.Signature:
      return { ...item, signatures: item.signatures.map(toJsonSample) };
    default:
      return item;
  }
};

export const serializeSurveySummary = (summary: TSurveySummary): TSurveySummaryResource => ({
  meta: summary.meta,
  dropOff: summary.dropOff,
  quotas: summary.quotas,
  summary: summary.summary.map(serializeSummaryItem),
});
