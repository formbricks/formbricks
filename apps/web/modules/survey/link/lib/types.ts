export type TLinkSurveySearchParams = {
  suId?: string;
  verify?: string;
  lang?: string;
  embed?: string;
  preview?: string;
  suToken?: string;
  prefillToken?: string;
} & Record<string, string | string[] | undefined>;
