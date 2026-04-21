import { Container, Heading, Hr, Text } from "@react-email/components";
import { EmailButton } from "../../src/components/email-button";
import { EmailFooter } from "../../src/components/email-footer";
import { EmailTemplate } from "../../src/components/email-template";
import { t as mockT } from "../../src/lib/mock-translate";
import { TEmailTemplateLegalProps } from "../../src/types/email";
import { TFunction } from "../../src/types/translations";

export interface InvitationEmailProps extends TEmailTemplateLegalProps {
  readonly subject: string;
  readonly body: string;
  readonly surveyLink: string;
  readonly buttonLabel?: string;
  readonly logoUrl?: string;
  readonly t?: TFunction;
}

export function InvitationEmail({
  body,
  surveyLink,
  buttonLabel,
  logoUrl,
  t = mockT,
  ...legalProps
}: InvitationEmailProps): React.JSX.Element {
  return (
    <EmailTemplate logoUrl={logoUrl} t={t} {...legalProps}>
      <Container>
        <Heading>{t("emails.invitation_heading")}</Heading>
        {/* Body is plain text with merge fields already substituted. Preserve newlines
            via CSS so we don't need to inject HTML (avoids XSS surface). */}
        <Text className="text-sm whitespace-pre-wrap">{body}</Text>
        <EmailButton href={surveyLink} label={buttonLabel ?? t("emails.invitation_button_label")} />
        <Hr className="my-4" />
        <Text className="text-xs text-slate-400">
          {t("emails.invitation_fallback_link")}
          <br />
          {surveyLink}
        </Text>
        <EmailFooter t={t} />
      </Container>
    </EmailTemplate>
  );
}

export default function InvitationEmailPreview(): React.JSX.Element {
  return (
    <InvitationEmail
      subject="Please take our member satisfaction survey"
      body={"Hi Jane,\n\nWe’d love to hear from you. This short survey takes about 5 minutes.\n\nThank you!"}
      surveyLink="https://surveys.example.com/c/abc123"
      buttonLabel="Take the survey"
    />
  );
}
