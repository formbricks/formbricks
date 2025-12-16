import { Container, Heading, Text } from "@react-email/components";
import { EmailTemplate } from "@/src/components/email-template";
import { exampleData } from "@/src/lib/example-data";
import { t as mockT } from "@/src/lib/mock-translate";

type TFunction = (key: string, replacements?: Record<string, string>) => string;

interface EmbedSurveyPreviewEmailProps {
  html: string;
  environmentId: string;
  logoUrl?: string;
  t?: TFunction;
}

export function EmbedSurveyPreviewEmail({
  html,
  environmentId,
  logoUrl,
  t = mockT,
}: EmbedSurveyPreviewEmailProps): React.JSX.Element {
  return (
    <EmailTemplate logoUrl={logoUrl} t={t}>
      <Container>
        <Heading>{t("emails.embed_survey_preview_email_heading")}</Heading>
        <Text className="text-sm">{t("emails.embed_survey_preview_email_text")}</Text>
        <Text className="text-sm">
          <b>{t("emails.embed_survey_preview_email_didnt_request")}</b>{" "}
          {t("emails.embed_survey_preview_email_fight_spam")}
        </Text>
        <div className="text-sm" dangerouslySetInnerHTML={{ __html: html }} />
        <Text className="text-center text-sm text-slate-700">
          {t("emails.embed_survey_preview_email_environment_id")}: {environmentId}
        </Text>
      </Container>
    </EmailTemplate>
  );
}

// Default export for preview server
export default function EmbedSurveyPreviewEmailPreview(): React.JSX.Element {
  return <EmbedSurveyPreviewEmail {...exampleData.embedSurveyPreviewEmail} />;
}
