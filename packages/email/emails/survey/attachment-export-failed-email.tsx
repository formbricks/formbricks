import { Container, Heading, Text } from "react-email";
import { EmailButton } from "../../src/components/email-button";
import { EmailFooter } from "../../src/components/email-footer";
import { EmailTemplate } from "../../src/components/email-template";
import { exampleData } from "../../src/lib/example-data";
import { t as mockT } from "../../src/lib/mock-translate";
import { TEmailTemplateLegalProps } from "../../src/types/email";
import { TFunction } from "../../src/types/translations";

/**
 * Why the export failed, as far as the reader can act on it: too many files or too slow to build both
 * call for a narrower filter, nothing to export is not worth retrying, and anything else is worth one
 * more try.
 */
export type TAttachmentExportFailureReason = "too_many_files" | "build_timeout" | "no_attachments" | "other";

interface AttachmentExportFailedEmailProps extends TEmailTemplateLegalProps {
  readonly surveyName: string;
  readonly reason: TAttachmentExportFailureReason;
  /** The most files one export can hold, formatted for the reader. */
  readonly maxFiles: string;
  /** The survey's Responses page, where the export can be started again. */
  readonly responsesLink: string;
  readonly t?: TFunction;
}

/**
 * An attachment export could not be built (ENG-6862). The requester was promised an email, so a failure
 * gets one too, rather than leaving them waiting.
 */
export function AttachmentExportFailedEmail({
  surveyName,
  reason,
  maxFiles,
  responsesLink,
  t = mockT,
  ...legalProps
}: Readonly<AttachmentExportFailedEmailProps>): React.JSX.Element {
  const advice: Record<TAttachmentExportFailureReason, string> = {
    too_many_files: t("emails.attachment_export_failed_email_reason_too_many_files", { maxFiles }),
    build_timeout: t("emails.attachment_export_failed_email_reason_build_timeout"),
    no_attachments: t("emails.attachment_export_failed_email_reason_no_attachments"),
    other: t("emails.attachment_export_failed_email_reason_other"),
  };
  return (
    <EmailTemplate t={t} {...legalProps}>
      <Container>
        <Heading>{t("emails.attachment_export_failed_email_heading")}</Heading>
        <Text className="text-sm">{t("emails.attachment_export_failed_email_text", { surveyName })}</Text>
        <Text className="text-sm">{advice[reason]}</Text>
        <EmailButton href={responsesLink} label={t("emails.attachment_export_failed_email_open_responses")} />
        <EmailFooter t={t} />
      </Container>
    </EmailTemplate>
  );
}

export default function AttachmentExportFailedEmailPreview(): React.JSX.Element {
  return <AttachmentExportFailedEmail {...exampleData.attachmentExportFailedEmail} />;
}
