export type TLinkSurveySearchParams = {
  suId?: string;
  verify?: string;
  lang?: string;
  embed?: string;
  preview?: string;
  suToken?: string;
  /** The creative whose link Destination opened the page (ENG-4001); checked server-side before use. */
  creativeId?: string;
} & Record<string, string | string[] | undefined>;
