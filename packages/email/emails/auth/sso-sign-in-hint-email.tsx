import { Container, Heading, Section, Text } from "react-email";
import { EmailButton } from "../../src/components/email-button";
import { EmailFooter } from "../../src/components/email-footer";
import { EmailTemplate } from "../../src/components/email-template";
import { exampleData } from "../../src/lib/example-data";
import { t as mockT } from "../../src/lib/mock-translate";
import { TEmailTemplateLegalProps } from "../../src/types/email";
import { TFunction } from "../../src/types/translations";

interface SsoSignInHintEmailProps extends TEmailTemplateLegalProps {
  /**
   * Display names of the identity providers the account signs in with and the login page offers, e.g.
   * "Microsoft". Empty when none of them is offered right now — the mail then sends the reader to their
   * administrator instead of to a login page with no button for them.
   */
  readonly providerNames: string[];
  /** The login page, where those providers' buttons are. */
  readonly loginLink: string;
  readonly t?: TFunction;
}

/**
 * Sent instead of a reset link when someone asks to reset the password of an account that has none
 * (ENG-3262). The forgot-password page answers the same way for every address, so it cannot tell an SSO
 * user why no link arrives without telling an anonymous visitor which addresses are registered. The mail
 * can: it only reaches the inbox on file, the same one a reset link would go to.
 *
 * Provider names are rendered as given, not translated — they are product names, and the login buttons
 * show them the same way.
 */
export function SsoSignInHintEmail({
  providerNames,
  loginLink,
  t = mockT,
  ...legalProps
}: Readonly<SsoSignInHintEmailProps>): React.JSX.Element {
  return (
    <EmailTemplate t={t} {...legalProps}>
      <Container>
        <Heading>{t("emails.sso_sign_in_hint_email_heading")}</Heading>
        {providerNames.length > 0 ? (
          <>
            <Text className="text-sm">{t("emails.sso_sign_in_hint_email_text")}</Text>
            <Section className="mb-4">
              {providerNames.map((providerName) => (
                <Text key={providerName} className="my-1 text-sm font-bold">
                  {providerName}
                </Text>
              ))}
            </Section>
            <EmailButton href={loginLink} label={t("emails.sso_sign_in_hint_email_go_to_login")} />
            <Text className="text-sm">{t("emails.sso_sign_in_hint_email_no_access")}</Text>
          </>
        ) : (
          <Text className="text-sm">{t("emails.sso_sign_in_hint_email_text_unavailable")}</Text>
        )}
        <Text className="mb-0 text-sm">{t("emails.sso_sign_in_hint_email_did_not_request")}</Text>
        <EmailFooter t={t} />
      </Container>
    </EmailTemplate>
  );
}

export default function SsoSignInHintEmailPreview(): React.JSX.Element {
  return <SsoSignInHintEmail {...exampleData.ssoSignInHintEmail} />;
}
