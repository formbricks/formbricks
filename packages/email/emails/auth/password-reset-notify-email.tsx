import { Container, Heading, Text } from "@react-email/components";
import { EmailFooter } from "../../src/components/email-footer";
import { EmailTemplate } from "../../src/components/email-template";
import { exampleData } from "../../src/lib/example-data";
import { t as mockT } from "../../src/lib/mock-translate";
import { TFunction } from "../../src/types/translations";

interface PasswordResetNotifyEmailProps {
  readonly t?: TFunction;
}

export function PasswordResetNotifyEmail({
  t = mockT,
}: PasswordResetNotifyEmailProps = {}): React.JSX.Element {
  return (
    <EmailTemplate t={t}>
      <Container>
        <Heading>{t("emails.password_changed_email_heading")}</Heading>
        <Text className="text-sm">{t("emails.password_changed_email_text")}</Text>
        <EmailFooter t={t} />
      </Container>
    </EmailTemplate>
  );
}

export default function PasswordResetNotifyEmailPreview(): React.JSX.Element {
  return <PasswordResetNotifyEmail {...exampleData.passwordResetNotifyEmail} />;
}
