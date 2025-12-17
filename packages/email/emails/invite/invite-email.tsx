import { Container, Heading, Text } from "@react-email/components";
import { EmailButton } from "../../src/components/email-button";
import { EmailFooter } from "../../src/components/email-footer";
import { EmailTemplate } from "../../src/components/email-template";
import { exampleData } from "../../src/lib/example-data";
import { t as mockT } from "../../src/lib/mock-translate";

type TFunction = (key: string, replacements?: Record<string, string>) => string;

interface InviteEmailProps {
  readonly inviteeName: string;
  readonly inviterName: string;
  readonly verifyLink: string;
  readonly t?: TFunction;
}

export function InviteEmail({
  inviteeName,
  inviterName,
  verifyLink,
  t = mockT,
}: InviteEmailProps): React.JSX.Element {
  return (
    <EmailTemplate t={t}>
      <Container>
        <Heading>
          {t("emails.invite_email_heading", { inviteeName })} {inviteeName}
        </Heading>
        <Text className="text-sm">
          {t("emails.invite_email_text_par1", { inviterName })} {inviterName}{" "}
          {t("emails.invite_email_text_par2")}
        </Text>
        <EmailButton href={verifyLink} label={t("emails.invite_email_button_label")} />
        <EmailFooter t={t} />
      </Container>
    </EmailTemplate>
  );
}

export default function InviteEmailPreview(): React.JSX.Element {
  return <InviteEmail {...exampleData.inviteEmail} />;
}
