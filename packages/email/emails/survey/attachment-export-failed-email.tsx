import { Container, Heading, Text } from "react-email";
import { EmailButton } from "../../src/components/email-button";
import { EmailFooter } from "../../src/components/email-footer";
import { EmailTemplate } from "../../src/components/email-template";
import { exampleData } from "../../src/lib/example-data";
import { t as mockT } from "../../src/lib/mock-translate";
import { TEmailTemplateLegalProps } from "../../src/types/email";
import { TFunction } from "../../src/types/translations";

interface AttachmentExportFailedEmailProps extends TEmailTemplateLegalProps {
  readonly surveyName: string;
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
  responsesLink,
  t = mockT,
  ...legalProps
}: Readonly<AttachmentExportFailedEmailProps>): React.JSX.Element {
  return (
    <EmailTemplate t={t} {...legalProps}>
      <Container>
        <Heading>{t("emails.attachment_export_failed_email_heading")}</Heading>
        <Text className="text-sm">{t("emails.attachment_export_failed_email_text", { surveyName })}</Text>
        <EmailButton href={responsesLink} label={t("emails.attachment_export_failed_email_open_responses")} />
        <EmailFooter t={t} />
      </Container>
    </EmailTemplate>
  );
}

export default function AttachmentExportFailedEmailPreview(): React.JSX.Element {
  return <AttachmentExportFailedEmail {...exampleData.attachmentExportFailedEmail} />;
}
