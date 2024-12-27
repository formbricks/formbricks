import { Body, Column, Container, Html, Img, Link, Section, Tailwind, Text } from "@react-email/components";
import { IMPRINT_ADDRESS, IMPRINT_URL, PRIVACY_URL } from "@formbricks/lib/constants";

export function EmailTemplate({ children }): React.JSX.Element {
  return (
    <Html>
      <Tailwind>
        <Body
          className="m-0 h-full w-full justify-center bg-slate-50 p-6 text-center text-base font-medium text-slate-800"
          style={{
            fontFamily: "'Jost', 'Helvetica Neue', 'Segoe UI', 'Helvetica', 'sans-serif'",
          }}>
          <Section>
            <Link href="https://formbricks.com?utm_source=email_header&utm_medium=email" target="_blank">
              <Img
                alt="Formbricks Logo"
                className="mx-auto w-80"
                src="https://s3.eu-central-1.amazonaws.com/listmonk-formbricks/Formbricks-Light-transparent.png"
              />
            </Link>
          </Section>
          <Container className="mx-auto my-8 max-w-xl bg-white p-4 text-left">{children}</Container>

          <Section className="mt-4 text-center text-sm">
            <Text className="m-0 font-normal text-slate-500">This email was sent via Formbricks.</Text>
            {IMPRINT_ADDRESS && (
              <Text className="m-0 font-normal text-slate-500 opacity-50">{IMPRINT_ADDRESS}</Text>
            )}
            <Text className="m-0 font-normal text-slate-500 opacity-50">
              {IMPRINT_URL && (
                <Link href={IMPRINT_URL} target="_blank" rel="noopener noreferrer" className="text-slate-500">
                  Imprint{" "}
                </Link>
              )}
              {IMPRINT_URL && PRIVACY_URL && "•"}
              {PRIVACY_URL && (
                <Link href={PRIVACY_URL} target="_blank" rel="noopener noreferrer" className="text-slate-500">
                  {" "}
                  Privacy Policy
                </Link>
              )}
            </Text>
          </Section>
        </Body>
      </Tailwind>
    </Html>
  );
}
