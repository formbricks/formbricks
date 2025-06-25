import { getTranslate } from "@/tolgee/server";
import { Container, Heading, Text } from "@react-email/components";
import React from "react";
import { EmailTemplate } from "../../components/email-template";

interface EmailCustomizationPreviewEmailProps {
  userName: string;
  logoUrl?: string;
}

export async function EmailCustomizationPreviewEmail({
  userName,
  logoUrl,
}: EmailCustomizationPreviewEmailProps): Promise<React.JSX.Element> {
  const t = await getTranslate();
  return (
    <EmailTemplate logoUrl={logoUrl} t={t}>
      <Container>
        <Heading className="text-xl">
          {t("emails.email_customization_preview_email_heading", { userName })}
        </Heading>
        <Text className="font-normal">{t("emails.email_customization_preview_email_text")}</Text>
      </Container>
    </EmailTemplate>
  );
}

export default EmailCustomizationPreviewEmail;
