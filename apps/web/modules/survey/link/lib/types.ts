export type TLinkSurveySearchParams = {
  suId?: string;
  verify?: string;
  lang?: string;
  embed?: string;
  preview?: string;
  suToken?: string;
} & Record<string, string | string[] | undefined>;
