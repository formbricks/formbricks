import { Container, Heading, Text } from "@react-email/components";
import { EmailTemplate } from "../../src/components/email-template";
import { exampleData } from "../../src/lib/example-data";
import { t as mockT } from "../../src/lib/mock-translate";
import { TEmailTemplateLegalProps } from "../../src/types/email";
import { TFunction } from "../../src/types/translations";

interface EmbedSurveyPreviewEmailProps extends TEmailTemplateLegalProps {
  readonly html: string;
  readonly environmentId: string;
  readonly logoUrl?: string;
  readonly t?: TFunction;
}

export function EmbedSurveyPreviewEmail({
  html,
  environmentId,
  logoUrl,
  t = mockT,
  ...legalProps
}: EmbedSurveyPreviewEmailProps): React.JSX.Element {
  return (
    <EmailTemplate logoUrl={logoUrl} t={t} {...legalProps}>
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

export default function EmbedSurveyPreviewEmailPreview(): React.JSX.Element {
  return <EmbedSurveyPreviewEmail {...exampleData.embedSurveyPreviewEmail} />;
}
