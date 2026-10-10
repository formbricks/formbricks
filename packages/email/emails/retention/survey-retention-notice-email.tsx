import { Container, Heading, Link, Section, Text } from "react-email";
import { EmailButton } from "../../src/components/email-button";
import { EmailFooter } from "../../src/components/email-footer";
import { EmailTemplate } from "../../src/components/email-template";
import { exampleData } from "../../src/lib/example-data";
import { t as mockT } from "../../src/lib/mock-translate";
import { TEmailTemplateLegalProps } from "../../src/types/email";
import { TFunction } from "../../src/types/translations";

/** A survey the surveys policy will archive. Dates are already formatted for the reader. */
export type TRetentionNoticeArchivedSurvey = {
  readonly name: string;
  readonly url: string;
  readonly archiveDate: string;
  readonly deleteDate: string;
};

/** A survey whose responses the responses policy will start deleting. */
export type TRetentionNoticeResponseDeletion = {
  readonly name: string;
  readonly url: string;
  /** How many responses are due by `deleteDate`, formatted ("1,204", "10,000+"). */
  readonly count: string;
  readonly deleteDate: string;
};

interface SurveyRetentionNoticeEmailProps extends TEmailTemplateLegalProps {
  readonly organizationName: string;
  readonly archivedSurveys: readonly TRetentionNoticeArchivedSurvey[];
  readonly responseDeletions: readonly TRetentionNoticeResponseDeletion[];
  /** The organisation's Data retention settings, where an exemption keeps a survey's data. */
  readonly settingsLink: string;
  readonly t?: TFunction;
}

/**
 * The data retention notice for one person, one night (ENG-3612): the surveys their organisation's
 * policies will act on, each with its date. Survey names are the organisation's own; nothing from a
 * response is ever included.
 */
export function SurveyRetentionNoticeEmail({
  organizationName,
  archivedSurveys,
  responseDeletions,
  settingsLink,
  t = mockT,
  ...legalProps
}: Readonly<SurveyRetentionNoticeEmailProps>): React.JSX.Element {
  return (
    <EmailTemplate t={t} {...legalProps}>
      <Container>
        <Heading>{t("emails.retention_notice_email_heading")}</Heading>
        <Text className="text-sm">{t("emails.retention_notice_email_text", { organizationName })}</Text>
        {responseDeletions.length > 0 && (
          <Section className="mb-4">
            <Text className="mb-1 text-sm font-bold">
              {t("emails.retention_notice_email_responses_heading")}
            </Text>
            {responseDeletions.map((survey) => (
              <Text key={survey.url} className="my-1 text-sm">
                <Link href={survey.url}>{survey.name}</Link>
                {" · "}
                {t("emails.retention_notice_email_responses_item", {
                  count: survey.count,
                  date: survey.deleteDate,
                })}
              </Text>
            ))}
            <Text className="mt-1 text-sm">{t("emails.retention_notice_email_responses_after")}</Text>
          </Section>
        )}
        {archivedSurveys.length > 0 && (
          <Section className="mb-4">
            <Text className="mb-1 text-sm font-bold">
              {t("emails.retention_notice_email_surveys_heading")}
            </Text>
            {archivedSurveys.map((survey) => (
              <Text key={survey.url} className="my-1 text-sm">
                <Link href={survey.url}>{survey.name}</Link>
                {" · "}
                {t("emails.retention_notice_email_surveys_item", {
                  archiveDate: survey.archiveDate,
                  deleteDate: survey.deleteDate,
                })}
              </Text>
            ))}
          </Section>
        )}
        <Text className="text-sm">{t("emails.retention_notice_email_keep")}</Text>
        <EmailButton href={settingsLink} label={t("emails.retention_notice_email_view_settings")} />
        <EmailFooter t={t} />
      </Container>
    </EmailTemplate>
  );
}

export default function SurveyRetentionNoticeEmailPreview(): React.JSX.Element {
  return <SurveyRetentionNoticeEmail {...exampleData.surveyRetentionNoticeEmail} />;
}
