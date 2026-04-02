import { Container, Heading, Text } from "@react-email/components";
import { EmailButton } from "../../src/components/email-button";
import { EmailFooter } from "../../src/components/email-footer";
import { EmailTemplate } from "../../src/components/email-template";
import { exampleData } from "../../src/lib/example-data";
import { t as mockT } from "../../src/lib/mock-translate";
import { TEmailTemplateLegalProps } from "../../src/types/email";
import { TFunction } from "../../src/types/translations";

interface ForgotPasswordEmailProps extends TEmailTemplateLegalProps {
  readonly verifyLink: string;
  readonly linkValidityInMinutes: number;
  readonly t?: TFunction;
}

export function ForgotPasswordEmail({
  verifyLink,
  linkValidityInMinutes,
  t = mockT,
  ...legalProps
}: Readonly<ForgotPasswordEmailProps>): React.JSX.Element {
  return (
    <EmailTemplate t={t} {...legalProps}>
      <Container>
        <Heading>{t("emails.forgot_password_email_heading")}</Heading>
        <Text className="text-sm">{t("emails.forgot_password_email_text")}</Text>
        <EmailButton href={verifyLink} label={t("emails.forgot_password_email_change_password")} />
        <Text className="text-sm font-bold">
          {t("emails.forgot_password_email_link_valid_for_24_hours", {
            minutes: String(linkValidityInMinutes),
          })}
        </Text>
        <Text className="mb-0 text-sm">{t("emails.forgot_password_email_did_not_request")}</Text>
        <EmailFooter t={t} />
      </Container>
    </EmailTemplate>
  );
}

export default function ForgotPasswordEmailPreview(): React.JSX.Element {
  return <ForgotPasswordEmail {...exampleData.forgotPasswordEmail} />;
}
