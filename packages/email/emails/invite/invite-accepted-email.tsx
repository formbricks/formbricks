import { Container, Text } from "@react-email/components";
import React from "react";
import { EmailFooter } from "../../components/email-footer";
import { EmailTemplate } from "../../components/email-template";

interface InviteAcceptedEmailProps {
  inviterName: string;
  inviteeName: string;
}

export function InviteAcceptedEmail({
  inviterName,
  inviteeName,
}: InviteAcceptedEmailProps): React.JSX.Element {
  return (
    <EmailTemplate>
      <Container>
        <Text>Hey {inviterName},</Text>
        <Text>
          Just letting you know that {inviteeName} accepted your invitation. Have fun collaborating!{" "}
        </Text>
        <EmailFooter />
      </Container>
    </EmailTemplate>
  );
}

export default InviteAcceptedEmail;
