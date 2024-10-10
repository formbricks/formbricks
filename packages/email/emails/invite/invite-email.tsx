import { Container, Text } from "@react-email/components";
import React from "react";
import { EmailButton } from "../../components/email-button";
import { EmailFooter } from "../../components/email-footer";
import { EmailTemplate } from "../../components/email-template";

interface InviteEmailProps {
  inviteeName: string;
  inviterName: string;
  verifyLink: string;
}

export function InviteEmail({ inviteeName, inviterName, verifyLink }: InviteEmailProps): React.JSX.Element {
  return (
    <EmailTemplate>
      <Container>
        <Text>Hey {inviteeName},</Text>
        <Text>
          Your colleague {inviterName} invited you to join them at Formbricks. To accept the invitation,
          please click the link below:
        </Text>
        <EmailButton href={verifyLink} label="Join organization" />
        <EmailFooter />
      </Container>
    </EmailTemplate>
  );
}

export default InviteEmail;
