import { Container, Heading, Text } from "@react-email/components";
import { EmailButton } from "../../src/components/email-button";
import { EmailFooter } from "../../src/components/email-footer";
import { EmailTemplate } from "../../src/components/email-template";
import { exampleData } from "../../src/lib/example-data";
import { t as mockT } from "../../src/lib/mock-translate";
import { TEmailTemplateLegalProps } from "../../src/types/email";
import { TFunction } from "../../src/types/translations";

interface SsoRecoveryFactorsRemovedEmailProps extends TEmailTemplateLegalProps {
  /** Whether a password was cleared — omitted from the list when the account had none. */
  readonly passwordRemoved: boolean;
  /** Whether an enrolled second factor was removed. */
  readonly twoFactorRemoved: boolean;
  /** Where to re-enrol: the account security settings. */
  readonly securitySettingsLink: string;
  readonly t?: TFunction;
}

/**
 * Sent when SSO recovery stripped an account's local sign-in factors (ENG-2633).
 *
 * Recovery removes the password and any enrolled second factor from an account whose address was never
 * proven, because an attacker who registered on someone else's address is held out by nothing else once
 * recovery marks that address verified. The guard cannot tell that attacker from an owner who simply
 * never clicked a verification link — and on a default self-hosted install, where verification blocks
 * nothing, the owner is the likelier of the two. This mail is what stops the legitimate case being a
 * silent security downgrade: it names what was removed and points at re-enrolment.
 */
export function SsoRecoveryFactorsRemovedEmail({
  passwordRemoved,
  twoFactorRemoved,
  securitySettingsLink,
  t = mockT,
  ...legalProps
}: Readonly<SsoRecoveryFactorsRemovedEmailProps>): React.JSX.Element {
  return (
    <EmailTemplate t={t} {...legalProps}>
      <Container>
        <Heading>{t("emails.sso_recovery_factors_removed_email_heading")}</Heading>
        <Text className="text-sm">{t("emails.sso_recovery_factors_removed_email_text")}</Text>
        {passwordRemoved ? (
          <Text className="mb-0 text-sm font-bold">
            {t("emails.sso_recovery_factors_removed_email_password")}
          </Text>
        ) : null}
        {twoFactorRemoved ? (
          <Text className="mb-0 text-sm font-bold">
            {t("emails.sso_recovery_factors_removed_email_two_factor")}
          </Text>
        ) : null}
        <Text className="text-sm">{t("emails.sso_recovery_factors_removed_email_sign_in_hint")}</Text>
        <EmailButton
          href={securitySettingsLink}
          label={t("emails.sso_recovery_factors_removed_email_review_security")}
        />
        <Text className="mb-0 text-sm">{t("emails.sso_recovery_factors_removed_email_did_not_expect")}</Text>
        <EmailFooter t={t} />
      </Container>
    </EmailTemplate>
  );
}

export default function SsoRecoveryFactorsRemovedEmailPreview(): React.JSX.Element {
  return <SsoRecoveryFactorsRemovedEmail {...exampleData.ssoRecoveryFactorsRemovedEmail} />;
}
