import { Container, Text } from "@react-email/components";

import { EmailFooter } from "./EmailFooter";

interface InviteAcceptedEmail {
  inviterName: string;
  inviteeName: string;
}

export const InviteAcceptedEmail = ({ inviterName, inviteeName }: InviteAcceptedEmail) => {
  return (
    <Container>
      <Text>Hey {inviterName},</Text>
      <Text>Just letting you know that {inviteeName} accepted your invitation. Have fun collaborating! </Text>
      <EmailFooter />
    </Container>
  );
};
