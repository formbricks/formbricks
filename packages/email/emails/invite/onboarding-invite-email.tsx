import { Container, Heading, Text } from "@react-email/components";
import { EmailButton } from "../../components/email-button";
import { EmailFooter } from "../../components/email-footer";
import { EmailTemplate } from "../../components/email-template";

interface OnboardingInviteEmailProps {
  inviteMessage: string;
  inviterName: string;
  verifyLink: string;
}

export function OnboardingInviteEmail({
  inviteMessage,
  inviterName,
  verifyLink,
}: OnboardingInviteEmailProps): React.JSX.Element {
  return (
    <EmailTemplate>
      <Container>
        <Heading>Hey 👋</Heading>
        <Text>{inviteMessage}</Text>
        <Text className="font-medium">Get Started in Minutes</Text>
        <ol>
          <li>Create an account to join {inviterName}&apos;s organization.</li>
          <li>Connect Formbricks to your app or website via HTML Snippet or NPM in just a few minutes.</li>
          <li>Done ✅</li>
        </ol>
        <EmailButton href={verifyLink} label={`Join ${inviterName}'s organization`} />
        <EmailFooter />
      </Container>
    </EmailTemplate>
  );
}

export default OnboardingInviteEmail;
