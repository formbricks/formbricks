import { Body, Container, Html, Img, Link, Section, Tailwind, Text } from "@react-email/components";
import { TFnType } from "@tolgee/react";
import React from "react";
import { FB_LOGO_URL, IMPRINT_ADDRESS, IMPRINT_URL, PRIVACY_URL } from "@formbricks/lib/constants";

const fbLogoUrl = FB_LOGO_URL;
const logoLink = "https://formbricks.com?utm_source=email_header&utm_medium=email";

interface EmailTemplateProps {
  readonly children: React.ReactNode;
  readonly logoUrl?: string;
  readonly t: TFnType;
}

export async function EmailTemplate({
  children,
  logoUrl,
  t,
}: EmailTemplateProps): Promise<React.JSX.Element> {
  const isDefaultLogo = !logoUrl || logoUrl === fbLogoUrl;

  return (
    <Html>
      <Tailwind>
        <Body
          className="m-0 h-full w-full justify-center bg-slate-50 p-6 text-center text-base font-medium text-slate-800"
          style={{
            fontFamily: "'Jost', 'Helvetica Neue', 'Segoe UI', 'Helvetica', 'sans-serif'",
          }}>
          <Section>
            {isDefaultLogo ? (
              <Link href={logoLink} target="_blank">
                <Img data-testid="default-logo-image" alt="Logo" className="mx-auto w-60" src={fbLogoUrl} />
              </Link>
            ) : (
              <Img
                data-testid="logo-image"
                alt="Logo"
                className="mx-auto max-h-[100px] w-80 object-contain"
                src={logoUrl}
              />
            )}
          </Section>
          <Container className="mx-auto my-8 max-w-xl rounded-md bg-white p-4 text-left">
            {children}
          </Container>

          <Section className="mt-4 text-center text-sm">
            <Text className="m-0 font-normal text-slate-500">{t("emails.email_template_text_1")}</Text>
            {IMPRINT_ADDRESS && (
              <Text className="m-0 font-normal text-slate-500 opacity-50">{IMPRINT_ADDRESS}</Text>
            )}
            <Text className="m-0 font-normal text-slate-500 opacity-50">
              {IMPRINT_URL && (
                <Link href={IMPRINT_URL} target="_blank" rel="noopener noreferrer" className="text-slate-500">
                  {t("emails.imprint")}
                </Link>
              )}
              {IMPRINT_URL && PRIVACY_URL && " • "}
              {PRIVACY_URL && (
                <Link href={PRIVACY_URL} target="_blank" rel="noopener noreferrer" className="text-slate-500">
                  {t("emails.privacy_policy")}
                </Link>
              )}
            </Text>
          </Section>
        </Body>
      </Tailwind>
    </Html>
  );
}
