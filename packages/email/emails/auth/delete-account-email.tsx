import { Container, Heading, Text } from "@react-email/components";
import { EmailButton } from "../../src/components/email-button";
import { EmailFooter } from "../../src/components/email-footer";
import { EmailTemplate } from "../../src/components/email-template";
import { exampleData } from "../../src/lib/example-data";
import { t as mockT } from "../../src/lib/mock-translate";
import { TEmailTemplateLegalProps } from "../../src/types/email";
import { TFunction } from "../../src/types/translations";

interface DeleteAccountEmailProps extends TEmailTemplateLegalProps {
  readonly deleteLink: string;
  readonly linkValidityInMinutes: number;
  readonly t?: TFunction;
}

export function DeleteAccountEmail({
  deleteLink,
  linkValidityInMinutes,
  t = mockT,
  ...legalProps
}: Readonly<DeleteAccountEmailProps>): React.JSX.Element {
  return (
    <EmailTemplate t={t} {...legalProps}>
      <Container>
        <Heading>{t("emails.delete_account_email_heading")}</Heading>
        <Text className="text-sm">{t("emails.delete_account_email_text")}</Text>
        <Text className="text-sm font-bold">{t("emails.delete_account_email_warning")}</Text>
        <EmailButton href={deleteLink} label={t("emails.delete_account_email_confirm_deletion")} />
        <Text className="text-sm font-bold">
          {t("emails.delete_account_email_link_valid_for_minutes", {
            minutes: String(linkValidityInMinutes),
          })}
        </Text>
        <Text className="mb-0 text-sm">{t("emails.delete_account_email_did_not_request")}</Text>
        <EmailFooter t={t} />
      </Container>
    </EmailTemplate>
  );
}

export default function DeleteAccountEmailPreview(): React.JSX.Element {
  return <DeleteAccountEmail {...exampleData.deleteAccountEmail} />;
}
