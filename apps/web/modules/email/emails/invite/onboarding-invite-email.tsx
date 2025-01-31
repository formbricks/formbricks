import { Container, Heading, Text } from "@react-email/components";
import { EmailButton } from "../../components/email-button";
import { EmailFooter } from "../../components/email-footer";
import { EmailTemplate } from "../../components/email-template";
import { translateEmailText } from "../../lib/utils";

interface OnboardingInviteEmailProps {
  inviteMessage: string;
  inviterName: string;
  verifyLink: string;
  locale: string;
  inviteeName: string;
}

export function OnboardingInviteEmail({
  inviteMessage,
  inviterName,
  verifyLink,
  locale,
  inviteeName,
}: OnboardingInviteEmailProps): React.JSX.Element {
  return (
    <EmailTemplate locale={locale}>
      <Container>
        <Heading>
          {translateEmailText("onboarding_invite_email_heading", locale)} {inviteeName} 👋
        </Heading>
        <Text>{inviteMessage}</Text>
        <Text className="font-medium">
          {translateEmailText("onboarding_invite_email_get_started_in_minutes", locale)}
        </Text>
        <ol>
          <li>{translateEmailText("onboarding_invite_email_create_account", locale, { inviterName })}</li>
          <li>{translateEmailText("onboarding_invite_email_connect_formbricks", locale)}</li>
          <li>{translateEmailText("onboarding_invite_email_done", locale)} ✅</li>
        </ol>
        <EmailButton
          href={verifyLink}
          label={translateEmailText("onboarding_invite_email_button_label", locale, { inviterName })}
        />
        <EmailFooter locale={locale} />
      </Container>
    </EmailTemplate>
  );
}

export default OnboardingInviteEmail;
