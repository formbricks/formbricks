import { Container, Text } from "@react-email/components";
import React from "react";
import { EmailFooter } from "../../components/email-footer";
import { EmailTemplate } from "../../components/email-template";
import { translateEmailText } from "../../lib/utils";

interface InviteAcceptedEmailProps {
  inviterName: string;
  inviteeName: string;
  locale: string;
}

export function InviteAcceptedEmail({
  inviterName,
  inviteeName,
  locale,
}: InviteAcceptedEmailProps): React.JSX.Element {
  return (
    <EmailTemplate locale={locale}>
      <Container>
        <Text>
          {translateEmailText("invite_accepted_email_heading", locale)} {inviterName},
        </Text>
        <Text>
          {translateEmailText("invite_accepted_email_text_par1", locale)} {inviteeName}{" "}
          {translateEmailText("invite_accepted_email_text_par2", locale)}
        </Text>
        <EmailFooter locale={locale} />
      </Container>
    </EmailTemplate>
  );
}

export default InviteAcceptedEmail;
