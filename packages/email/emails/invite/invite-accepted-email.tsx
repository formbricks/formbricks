import { Container, Heading, Text } from "@react-email/components";
import { EmailFooter } from "../../src/components/email-footer";
import { EmailTemplate } from "../../src/components/email-template";
import { exampleData } from "../../src/lib/example-data";
import { t as mockT } from "../../src/lib/mock-translate";
import { TEmailTemplateLegalProps } from "../../src/types/email";
import { TFunction } from "../../src/types/translations";

interface InviteAcceptedEmailProps extends TEmailTemplateLegalProps {
  readonly inviterName: string;
  readonly inviteeName: string;
  readonly t?: TFunction;
}

export function InviteAcceptedEmail({
  inviterName,
  inviteeName,
  t = mockT,
  ...legalProps
}: InviteAcceptedEmailProps): React.JSX.Element {
  return (
    <EmailTemplate t={t} {...legalProps}>
      <Container>
        <Heading>
          {t("emails.invite_accepted_email_heading", { inviterName })} {inviterName}
        </Heading>
        <Text className="text-sm">
          {t("emails.invite_accepted_email_text_par1", { inviteeName })} {inviteeName}{" "}
          {t("emails.invite_accepted_email_text_par2")}
        </Text>
        <EmailFooter t={t} />
      </Container>
    </EmailTemplate>
  );
}

export default function InviteAcceptedEmailPreview(): React.JSX.Element {
  return <InviteAcceptedEmail {...exampleData.inviteAcceptedEmail} />;
}
