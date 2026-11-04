import { Container, Heading, Text } from "react-email";
import { EmailFooter } from "../../src/components/email-footer";
import { EmailTemplate } from "../../src/components/email-template";
import { exampleData } from "../../src/lib/example-data";
import { t as mockT } from "../../src/lib/mock-translate";
import { TEmailTemplateLegalProps } from "../../src/types/email";
import { TFunction } from "../../src/types/translations";

interface AccountDeletedEmailProps extends TEmailTemplateLegalProps {
  readonly t?: TFunction;
}

export function AccountDeletedEmail({
  t = mockT,
  ...legalProps
}: AccountDeletedEmailProps = {}): React.JSX.Element {
  return (
    <EmailTemplate t={t} {...legalProps}>
      <Container>
        <Heading>{t("emails.account_deleted_email_heading")}</Heading>
        <Text className="text-sm">{t("emails.account_deleted_email_text")}</Text>
        <Text className="text-sm">{t("emails.account_deleted_email_did_not_request")}</Text>
        <EmailFooter t={t} />
      </Container>
    </EmailTemplate>
  );
}

export default function AccountDeletedEmailPreview(): React.JSX.Element {
  return <AccountDeletedEmail {...exampleData.accountDeletedEmail} />;
}
