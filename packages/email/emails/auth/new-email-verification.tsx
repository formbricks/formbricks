import { Container, Heading, Link, Text } from "@react-email/components";
import { EmailButton } from "@/src/components/email-button";
import { EmailFooter } from "@/src/components/email-footer";
import { EmailTemplate } from "@/src/components/email-template";
import { exampleData } from "@/src/lib/example-data";
import { t as mockT } from "@/src/lib/mock-translate";

type TFunction = (key: string, replacements?: Record<string, string>) => string;

interface NewEmailVerificationProps {
  readonly verifyLink: string;
  readonly t?: TFunction;
}

export function NewEmailVerification({
  verifyLink,
  t = mockT,
}: NewEmailVerificationProps): React.JSX.Element {
  return (
    <EmailTemplate t={t}>
      <Container>
        <Heading>{t("emails.verification_email_heading")}</Heading>
        <Text className="text-sm">{t("emails.new_email_verification_text")}</Text>
        <Text className="text-sm">{t("emails.verification_security_notice")}</Text>
        <EmailButton href={verifyLink} label={t("emails.verification_email_verify_email")} />
        <Text className="text-sm">{t("emails.verification_email_click_on_this_link")}</Text>
        <Link className="break-all text-sm text-black" href={verifyLink}>
          {verifyLink}
        </Link>
        <Text className="text-sm font-bold">{t("emails.verification_email_link_valid_for_24_hours")}</Text>
        <EmailFooter t={t} />
      </Container>
    </EmailTemplate>
  );
}

// Default export for preview server
export default function NewEmailVerificationPreview(): React.JSX.Element {
  return <NewEmailVerification {...exampleData.newEmailVerification} />;
}
