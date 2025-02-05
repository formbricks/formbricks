import { getTranslate } from "@/tolgee/server";
import { Container, Heading, Text } from "@react-email/components";
import { EmailButton } from "../../components/email-button";
import { EmailFooter } from "../../components/email-footer";
import { EmailTemplate } from "../../components/email-template";

interface OnboardingInviteEmailProps {
  inviteMessage: string;
  inviterName: string;
  verifyLink: string;
  inviteeName: string;
}

export async function OnboardingInviteEmail({
  inviteMessage,
  inviterName,
  verifyLink,
  inviteeName,
}: OnboardingInviteEmailProps): Promise<React.JSX.Element> {
  const t = await getTranslate();
  return (
    <EmailTemplate t={t}>
      <Container>
        <Heading>{t("emails.onboarding_invite_email_heading", { inviteeName })}</Heading>
        <Text>{inviteMessage}</Text>
        <Text className="font-medium">{t("emails.onboarding_invite_email_get_started_in_minutes")}</Text>
        <ol>
          <li>{t("emails.onboarding_invite_email_create_account", { inviterName })}</li>
          <li>{t("emails.onboarding_invite_email_connect_formbricks")}</li>
          <li>{t("emails.onboarding_invite_email_done")} ✅</li>
        </ol>
        <EmailButton
          href={verifyLink}
          label={t("emails.onboarding_invite_email_button_label", { inviterName })}
        />
        <EmailFooter t={t} />
      </Container>
    </EmailTemplate>
  );
}

export default OnboardingInviteEmail;
