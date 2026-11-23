/** A survey rendered as the HTML body of an email, as the share modal's Email tab previews and copies it. */
export type TSurveyEmailEmbedResource = {
  surveyId: string;
  /** The email body fragment. The tab sanitizes it before previewing it, and shows it as code to copy. */
  html: string;
};
