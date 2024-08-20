import { Body, Column, Container, Html, Img, Link, Row, Section, Tailwind } from "@react-email/components";

interface EmailTemplateProps {
  content: JSX.Element;
}

export function EmailTemplate({ content }: EmailTemplateProps): React.JSX.Element {
  return (
    <Html>
      <Tailwind>
        <Body
          className="m-0 h-full w-full justify-center bg-slate-100 bg-slate-50 p-6 text-center text-base font-medium text-slate-800"
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
          <Container className="mx-auto my-8 max-w-xl bg-white p-4 text-left">{content}</Container>

          <Section>
            <Row>
              <Column align="right" key="twitter">
                <Link href="https://twitter.com/formbricks" target="_blank">
                  <Img
                    alt="Tw"
                    src="https://s3.eu-central-1.amazonaws.com/listmonk-formbricks/Twitter-transp.png"
                    title="Twitter"
                    width="32"
                  />
                </Link>
              </Column>
              <Column align="center" className="w-20" key="github">
                <Link href="https://formbricks.com/github" target="_blank">
                  <Img
                    alt="GitHub"
                    src="https://s3.eu-central-1.amazonaws.com/listmonk-formbricks/Github-transp.png"
                    title="GitHub"
                    width="32"
                  />
                </Link>
              </Column>
              <Column align="left" key="discord">
                <Link href="https://formbricks.com/discord" target="_blank">
                  <Img
                    alt="Discord"
                    src="https://s3.eu-central-1.amazonaws.com/listmonk-formbricks/Discord-transp.png"
                    title="Discord"
                    width="32"
                  />
                </Link>
              </Column>
            </Row>
          </Section>
          <Section className="mt-4 text-center">
            Formbricks {new Date().getFullYear()}. All rights reserved.
            <br />
            <Link
              href="https://formbricks.com/imprint?utm_source=email_footer&utm_medium=email"
              target="_blank">
              Imprint
            </Link>{" "}
            |{" "}
            <Link
              href="https://formbricks.com/privacy-policy?utm_source=email_footer&utm_medium=email"
              target="_blank">
              Privacy Policy
            </Link>
          </Section>
        </Body>
      </Tailwind>
    </Html>
  );
}
