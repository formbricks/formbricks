import { Container, Heading, Link, Text } from "@react-email/components";
import { TFunction } from "@/src/types/translations";
import { EmailButton } from "../../src/components/email-button";
import { EmailFooter } from "../../src/components/email-footer";
import { EmailTemplate } from "../../src/components/email-template";
import { exampleData } from "../../src/lib/example-data";
import { t as mockT } from "../../src/lib/mock-translate";

interface VerificationEmailProps {
  readonly verifyLink: string;
  readonly verificationRequestLink: string;
  readonly t?: TFunction;
}

export function VerificationEmail({
  verifyLink,
  verificationRequestLink,
  t = mockT,
}: VerificationEmailProps): React.JSX.Element {
  return (
    <EmailTemplate t={t}>
      <Container>
        <Heading>{t("emails.verification_email_heading")}</Heading>
        <Text className="text-sm">{t("emails.verification_email_text")}</Text>
        <EmailButton href={verifyLink} label={t("emails.verification_email_verify_email")} />
        <Text className="text-sm">{t("emails.verification_email_click_on_this_link")}</Text>
        <Link className="text-sm break-all text-black" href={verifyLink}>
          {verifyLink}
        </Link>
        <Text className="text-sm font-bold">{t("emails.verification_email_link_valid_for_24_hours")}</Text>
        <Text className="text-sm">
          {t("emails.verification_email_if_expired_request_new_token")}
          <Link className="text-sm text-black underline" href={verificationRequestLink}>
            {t("emails.verification_email_request_new_verification")}
          </Link>
        </Text>
        <EmailFooter t={t} />
      </Container>
    </EmailTemplate>
  );
}

export default function VerificationEmailPreview(): React.JSX.Element {
  return <VerificationEmail {...exampleData.verificationEmail} />;
}
