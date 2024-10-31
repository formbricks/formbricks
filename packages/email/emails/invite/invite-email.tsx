import { Container, Text } from "@react-email/components";
import React from "react";
import { EmailButton } from "../../components/email-button";
import { EmailFooter } from "../../components/email-footer";
import { EmailTemplate } from "../../components/email-template";
import { translateEmailText } from "../../lib/utils";

interface InviteEmailProps {
  inviteeName: string;
  inviterName: string;
  verifyLink: string;
  locale: string;
}

export function InviteEmail({
  inviteeName,
  inviterName,
  verifyLink,
  locale,
}: InviteEmailProps): React.JSX.Element {
  return (
    <EmailTemplate>
      <Container>
        <Text>
          {translateEmailText("invite_email_heading", locale)} {inviteeName},
        </Text>
        <Text>
          {translateEmailText("invite_email_text_par1", locale)} {inviterName}{" "}
          {translateEmailText("invite_email_text_par2", locale)}
        </Text>
        <EmailButton href={verifyLink} label="Join organization" />
        <EmailFooter />
      </Container>
    </EmailTemplate>
  );
}

export default InviteEmail;
