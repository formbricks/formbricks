import { Container, Text } from "@react-email/components";
import React from "react";

import { EmailFooter } from "../general/EmailFooter";

interface InviteAcceptedEmailProps {
  inviterName: string;
  inviteeName: string;
}

export const InviteAcceptedEmail = ({ inviterName, inviteeName }: InviteAcceptedEmailProps) => {
  return (
    <Container>
      <Text>Hey {inviterName},</Text>
      <Text>Just letting you know that {inviteeName} accepted your invitation. Have fun collaborating! </Text>
      <EmailFooter />
    </Container>
  );
};
