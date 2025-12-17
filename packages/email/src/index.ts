export { VerificationEmail } from "../emails/auth/verification-email";
export { ForgotPasswordEmail } from "../emails/auth/forgot-password-email";
export { NewEmailVerification } from "../emails/auth/new-email-verification";
export { PasswordResetNotifyEmail } from "../emails/auth/password-reset-notify-email";
export { InviteEmail } from "../emails/invite/invite-email";
export { InviteAcceptedEmail } from "../emails/invite/invite-accepted-email";
export { LinkSurveyEmail } from "../emails/survey/link-survey-email";
export { EmbedSurveyPreviewEmail } from "../emails/survey/embed-survey-preview-email";
export { ResponseFinishedEmail } from "../emails/survey/response-finished-email";
export { EmailCustomizationPreviewEmail } from "../emails/general/email-customization-preview-email";
export { FollowUpEmail } from "../emails/survey/follow-up-email";

export { EmailButton } from "./components/email-button";
export { EmailFooter } from "./components/email-footer";
export { EmailTemplate } from "./components/email-template";
export { ElementHeader } from "./components/email-element-header";

export {
  renderVerificationEmail,
  renderForgotPasswordEmail,
  renderNewEmailVerification,
  renderPasswordResetNotifyEmail,
  renderInviteEmail,
  renderInviteAcceptedEmail,
  renderLinkSurveyEmail,
  renderEmbedSurveyPreviewEmail,
  renderResponseFinishedEmail,
  renderEmailCustomizationPreviewEmail,
  renderFollowUpEmail,
} from "./lib/render";

export { render } from "@react-email/render";

export {
  Body,
  Button,
  Column,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Img,
  Link,
  Preview,
  Row,
  Section,
  Tailwind,
  Text,
} from "@react-email/components";

export type { ProcessedHiddenField, ProcessedResponseElement, ProcessedVariable } from "./types/follow-up";
