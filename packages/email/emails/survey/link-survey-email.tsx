import { Container, Heading, Text } from "@react-email/components";
import { TFunction } from "@/src/types/translations";
import { EmailButton } from "../../src/components/email-button";
import { EmailFooter } from "../../src/components/email-footer";
import { EmailTemplate } from "../../src/components/email-template";
import { exampleData } from "../../src/lib/example-data";
import { t as mockT } from "../../src/lib/mock-translate";

interface LinkSurveyEmailProps {
  readonly surveyName: string;
  readonly surveyLink: string;
  readonly logoUrl: string;
  readonly t?: TFunction;
}

export function LinkSurveyEmail({
  surveyName,
  surveyLink,
  logoUrl,
  t = mockT,
}: LinkSurveyEmailProps): React.JSX.Element {
  return (
    <EmailTemplate logoUrl={logoUrl} t={t}>
      <Container>
        <Heading>{t("emails.verification_email_hey")}</Heading>
        <Text className="text-sm">{t("emails.verification_email_thanks")}</Text>
        <Text className="text-sm">{t("emails.verification_email_to_fill_survey")}</Text>
        <EmailButton href={surveyLink} label={t("emails.verification_email_take_survey")} />
        <Text className="text-sm text-slate-400">
          {t("emails.verification_email_survey_name")}: {surveyName}
        </Text>
        <EmailFooter t={t} />
      </Container>
    </EmailTemplate>
  );
}

// Default export for preview server
export default function LinkSurveyEmailPreview(): React.JSX.Element {
  return <LinkSurveyEmail {...exampleData.linkSurveyEmail} />;
}
