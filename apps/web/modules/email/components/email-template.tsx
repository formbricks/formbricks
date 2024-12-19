import { Body, Column, Container, Html, Img, Link, Section, Tailwind } from "@react-email/components";
import { IMPRINT_URL, PRIVACY_URL } from "@formbricks/lib/constants";

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

          <Section className="flex justify-center">
            <Column align="center" className="px-2" key="twitter">
              <Link href="https://twitter.com/formbricks" target="_blank" className="w-fit">
                <Img
                  alt="Tw"
                  src="https://s3.eu-central-1.amazonaws.com/listmonk-formbricks/Twitter-transp.png"
                  title="Twitter"
                  width="32"
                />
              </Link>
            </Column>
            <Column align="center" className="px-2" key="github">
              <Link href="https://formbricks.com/github" target="_blank" className="w-fit">
                <Img
                  alt="GitHub"
                  src="https://s3.eu-central-1.amazonaws.com/listmonk-formbricks/Github-transp.png"
                  title="GitHub"
                  width="32"
                />
              </Link>
            </Column>
          </Section>
          <Section className="mt-4 text-center text-sm">
            Formbricks {new Date().getFullYear()}. All rights reserved.
            <br />
            {IMPRINT_URL && (
              <Link href={IMPRINT_URL} target="_blank" rel="noopener noreferrer">
                Imprint{" "}
              </Link>
            )}
            {IMPRINT_URL && PRIVACY_URL && "|"}
            {PRIVACY_URL && (
              <Link href={PRIVACY_URL} target="_blank" rel="noopener noreferrer">
                {" "}
                Privacy Policy
              </Link>
            )}
          </Section>
        </Body>
      </Tailwind>
    </Html>
  );
}
