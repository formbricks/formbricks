import { translateEmailText } from "@/modules/email/lib/utils";
import { Body, Container, Html, Img, Link, Section, Tailwind, Text } from "@react-email/components";
import { IMPRINT_ADDRESS, IMPRINT_URL, PRIVACY_URL } from "@formbricks/lib/constants";

const fbLogoUrl =
  "https://s3.eu-central-1.amazonaws.com/listmonk-formbricks/Formbricks-Light-transparent.png";
const logoLink = "https://formbricks.com?utm_source=email_header&utm_medium=email";

interface EmailTemplateProps {
  children: React.ReactNode;
  logoUrl?: string;
  locale: string;
}

export function EmailTemplate({ children, logoUrl, locale }: EmailTemplateProps): React.JSX.Element {
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
                <Img alt="Logo" className="mx-auto w-80" src={fbLogoUrl} />
              </Link>
            ) : (
              <Img alt="Logo" className="mx-auto max-h-[100px] w-80 object-contain" src={logoUrl} />
            )}
          </Section>
          <Container className="mx-auto my-8 max-w-xl rounded-md bg-white p-4 text-left">
            {children}
          </Container>

          <Section className="mt-4 text-center text-sm">
            <Text className="m-0 font-normal text-slate-500">
              {translateEmailText("email_template_text_1", locale)}
            </Text>
            {IMPRINT_ADDRESS && (
              <Text className="m-0 font-normal text-slate-500 opacity-50">{IMPRINT_ADDRESS}</Text>
            )}
            <Text className="m-0 font-normal text-slate-500 opacity-50">
              {IMPRINT_URL && (
                <Link href={IMPRINT_URL} target="_blank" rel="noopener noreferrer" className="text-slate-500">
                  {translateEmailText("imprint", locale)}
                </Link>
              )}
              {IMPRINT_URL && PRIVACY_URL && "•"}
              {PRIVACY_URL && (
                <Link href={PRIVACY_URL} target="_blank" rel="noopener noreferrer" className="text-slate-500">
                  {translateEmailText("privacy_policy", locale)}
                </Link>
              )}
            </Text>
          </Section>
        </Body>
      </Tailwind>
    </Html>
  );
}
