import { Container, Heading, Text } from "@react-email/components";
import React from "react";

import { EmailButton } from "../general/EmailButton";
import { EmailFooter } from "../general/EmailFooter";

interface OnboardingInviteEmailProps {
  inviteMessage: string;
  inviterName: string;
  verifyLink: string;
}

export const OnboardingInviteEmail = ({
  inviteMessage,
  inviterName,
  verifyLink,
}: OnboardingInviteEmailProps) => {
  return (
    <Container>
      <Heading>Hey 👋</Heading>
      <Text>{inviteMessage}</Text>
      <Text className="text-xl font-medium">Get Started in Minutes</Text>
      <ol>
        <li>Create an account to join {inviterName}&apos;s team.</li>
        <li>Connect Formbricks to your app or website via HTML Snippet or NPM in just a few minutes.</li>
        <li>Done ✅</li>
      </ol>
      <EmailButton label={`Join ${inviterName}'s team`} href={verifyLink} />
      <EmailFooter />
    </Container>
  );
};
