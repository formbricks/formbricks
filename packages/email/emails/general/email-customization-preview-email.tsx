import { Container, Heading, Text } from "@react-email/components";
import { TFunction } from "@/src/types/translations";
import { EmailTemplate } from "../../src/components/email-template";
import { exampleData } from "../../src/lib/example-data";
import { t as mockT } from "../../src/lib/mock-translate";

interface EmailCustomizationPreviewEmailProps {
  readonly userName: string;
  readonly logoUrl?: string;
  readonly t?: TFunction;
}

export function EmailCustomizationPreviewEmail({
  userName,
  logoUrl,
  t = mockT,
}: EmailCustomizationPreviewEmailProps): React.JSX.Element {
  return (
    <EmailTemplate logoUrl={logoUrl} t={t}>
      <Container>
        <Heading>{t("emails.email_customization_preview_email_heading", { userName })}</Heading>
        <Text className="text-sm">{t("emails.email_customization_preview_email_text")}</Text>
      </Container>
    </EmailTemplate>
  );
}

export default function EmailCustomizationPreviewEmailPreview(): React.JSX.Element {
  return <EmailCustomizationPreviewEmail {...exampleData.emailCustomizationPreviewEmail} />;
}
