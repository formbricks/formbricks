import { Container, Heading, Link, Text } from "@react-email/components";
import React from "react";
import { EmailButton } from "../general/email-button";
import { EmailFooter } from "../general/email-footer";

interface VerificationEmailProps {
  verifyLink: string;
  verificationRequestLink: string;
}

export function VerificationEmail({
  verifyLink,
  verificationRequestLink,
}: VerificationEmailProps): React.JSX.Element {
  return (
    <Container>
      <Heading>Almost there!</Heading>
      <Text>To start using Formbricks please verify your email below:</Text>
      <EmailButton href={verifyLink} label="Verify email" />
      <Text>You can also click on this link:</Text>
      <Link className="break-all text-black" href={verifyLink}>
        {verifyLink}
      </Link>
      <Text className="font-bold">The link is valid for 24h.</Text>
      <Text>
        If it has expired please request a new token here:{" "}
        <Link className="text-black underline" href={verificationRequestLink}>
          Request new verification
        </Link>
      </Text>
      <EmailFooter />
    </Container>
  );
}
