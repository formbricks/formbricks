import { Body, Container, Html, Img, Link, Section, Tailwind } from "@react-email/components";

type TFunction = (key: string, replacements?: Record<string, string>) => string;

const fbLogoUrl = "https://app.formbricks.com/logo-transparent.png";
const logoLink = "https://formbricks.com?utm_source=email_header&utm_medium=email";

interface EmailTemplateProps {
  readonly children: React.ReactNode;
  readonly logoUrl?: string;
  readonly t: TFunction;
}

export function EmailTemplate({ children, logoUrl, t }: EmailTemplateProps): React.JSX.Element {
  const isDefaultLogo = !logoUrl || logoUrl === fbLogoUrl;

  return (
    <Html>
      <Tailwind>
        <Body
          className="m-0 h-full w-full justify-center bg-slate-50 p-6 text-center text-sm text-slate-800"
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
            <Link
              className="m-0 text-sm font-normal text-slate-500"
              href="https://formbricks.com/?utm_source=email_header&utm_medium=email"
              target="_blank"
              rel="noopener noreferrer">
              {t("emails.email_template_text_1")}
            </Link>
          </Section>
        </Body>
      </Tailwind>
    </Html>
  );
}

export default EmailTemplate;
