import { Container, Heading, Text } from "react-email";
import { EmailButton } from "../../src/components/email-button";
import { EmailFooter } from "../../src/components/email-footer";
import { EmailTemplate } from "../../src/components/email-template";
import { exampleData } from "../../src/lib/example-data";
import { t as mockT } from "../../src/lib/mock-translate";
import { TEmailTemplateLegalProps } from "../../src/types/email";
import { TFunction } from "../../src/types/translations";

interface AttachmentExportReadyEmailProps extends TEmailTemplateLegalProps {
  readonly surveyName: string;
  /** The archive's size, formatted for the reader ("5.7 GB"). */
  readonly archiveSize: string;
  /** Files the export covered, and how many the archive holds, formatted for the reader. */
  readonly fileCount: string;
  readonly includedFileCount: string;
  /** The archive's size limit, formatted for the reader ("5 GB"). */
  readonly sizeLimit: string;
  /** How long the link works, in months. */
  readonly retentionMonths: string;
  /** The last day the link works, formatted for the reader. */
  readonly expiryDate: string;
  /** True when the archive stopped at its size limit, so some files are not in it. */
  readonly truncated: boolean;
  /** The app page that checks the reader is signed in, then starts the download. */
  readonly downloadLink: string;
  readonly t?: TFunction;
}

/**
 * An attachment export finished building (ENG-6862): the link downloads the ZIP, and keeps working until
 * the archive is deleted a few months later.
 */
export function AttachmentExportReadyEmail({
  surveyName,
  archiveSize,
  fileCount,
  includedFileCount,
  sizeLimit,
  retentionMonths,
  expiryDate,
  truncated,
  downloadLink,
  t = mockT,
  ...legalProps
}: Readonly<AttachmentExportReadyEmailProps>): React.JSX.Element {
  return (
    <EmailTemplate t={t} {...legalProps}>
      <Container>
        <Heading>{t("emails.attachment_export_ready_email_heading")}</Heading>
        <Text className="text-sm">{t("emails.attachment_export_ready_email_text", { surveyName })}</Text>
        <Text className="text-sm">
          {t("emails.attachment_export_ready_email_files", { includedFileCount, fileCount })}
          <br />
          {t("emails.attachment_export_ready_email_size", { size: archiveSize })}
        </Text>
        {truncated && (
          <Text className="text-sm">
            {t("emails.attachment_export_ready_email_truncated", { sizeLimit })}
          </Text>
        )}
        <EmailButton href={downloadLink} label={t("emails.attachment_export_ready_email_download")} />
        <Text className="text-sm">
          {t("emails.attachment_export_ready_email_expiry", { months: retentionMonths, date: expiryDate })}
        </Text>
        <EmailFooter t={t} />
      </Container>
    </EmailTemplate>
  );
}

export default function AttachmentExportReadyEmailPreview(): React.JSX.Element {
  return <AttachmentExportReadyEmail {...exampleData.attachmentExportReadyEmail} />;
}
