import { Container, Heading, Text } from "react-email";
import { EmailButton } from "../../src/components/email-button";
import { EmailFooter } from "../../src/components/email-footer";
import { EmailTemplate } from "../../src/components/email-template";
import { exampleData } from "../../src/lib/example-data";
import { t as mockT } from "../../src/lib/mock-translate";
import { TEmailTemplateLegalProps } from "../../src/types/email";
import { TFunction } from "../../src/types/translations";

interface MemberRetentionNoticeEmailProps extends TEmailTemplateLegalProps {
  readonly organizationName: string;
  /** When the account will be deactivated, formatted for the reader. */
  readonly deactivateDate: string;
  /** The sign-in page: signing in before the date keeps the account active. */
  readonly loginLink: string;
  readonly t?: TFunction;
}

/**
 * The members policy's notice (ENG-3612), to the member themself: their account will be deactivated for
 * inactivity on a date, and signing in before then keeps it.
 */
export function MemberRetentionNoticeEmail({
  organizationName,
  deactivateDate,
  loginLink,
  t = mockT,
  ...legalProps
}: Readonly<MemberRetentionNoticeEmailProps>): React.JSX.Element {
  return (
    <EmailTemplate t={t} {...legalProps}>
      <Container>
        <Heading>{t("emails.member_retention_notice_email_heading")}</Heading>
        <Text className="text-sm">
          {t("emails.member_retention_notice_email_text", { organizationName, date: deactivateDate })}
        </Text>
        <Text className="text-sm">{t("emails.member_retention_notice_email_keep")}</Text>
        <EmailButton href={loginLink} label={t("emails.member_retention_notice_email_sign_in")} />
        <EmailFooter t={t} />
      </Container>
    </EmailTemplate>
  );
}

export default function MemberRetentionNoticeEmailPreview(): React.JSX.Element {
  return <MemberRetentionNoticeEmail {...exampleData.memberRetentionNoticeEmail} />;
}
