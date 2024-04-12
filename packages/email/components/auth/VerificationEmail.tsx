import { Container, Heading, Link, Text } from "@react-email/components";
import React from "react";

import { EmailButton } from "../general/EmailButton";
import { EmailFooter } from "../general/EmailFooter";

interface VerificationEmailProps {
  verifyLink: string;
  verificationRequestLink: string;
}

export const VerificationEmail = ({ verifyLink, verificationRequestLink }: VerificationEmailProps) => {
  return (
    <Container>
      <Heading>Almost there!</Heading>
      <Text>To start using Formbricks please verify your email below:</Text>
      <EmailButton href={verifyLink} label={"Verify email"} />
      <Text>You can also click on this link:</Text>
      <Link href={verifyLink} className="break-all text-black">
        {verifyLink}
      </Link>
      <Text className="font-bold">The link is valid for 24h.</Text>
      <Text>
        If it has expired please request a new token here:{" "}
        <Link href={verificationRequestLink} className="text-black underline">
          Request new verification
        </Link>
      </Text>
      <EmailFooter />
    </Container>
  );
};
