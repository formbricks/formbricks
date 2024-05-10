import { Body, Column, Container, Html, Img, Link, Row, Section, Tailwind } from "@react-email/components";
import React, { Fragment } from "react";

interface EmailTemplateProps {
  content: JSX.Element;
}

export const EmailTemplate = ({ content }: EmailTemplateProps) => (
  <Html>
    <Tailwind>
      <Fragment>
        <Body
          className="m-0 h-full w-full justify-center bg-slate-100 bg-slate-50 p-6 text-center text-base font-medium text-slate-800"
          style={{
            fontFamily: "'Jost', 'Helvetica Neue', 'Segoe UI', 'Helvetica', 'sans-serif'",
          }}>
          <Section>
            <Link href="https://formbricks.com?utm_source=email_header&utm_medium=email" target="_blank">
              <Img
                src="https://s3.eu-central-1.amazonaws.com/listmonk-formbricks/Formbricks-Light-transparent.png"
                alt="Formbricks Logo"
                className="mx-auto w-80"
              />
            </Link>
          </Section>
          <Container className="mx-auto my-8 max-w-xl bg-white p-4 text-left">{content}</Container>

          <Section>
            <Row>
              <Column align="right" key="twitter">
                <Link target="_blank" href="https://twitter.com/formbricks">
                  <Img
                    title="Twitter"
                    src="https://s3.eu-central-1.amazonaws.com/listmonk-formbricks/Twitter-transp.png"
                    alt="Tw"
                    width="32"
                  />
                </Link>
              </Column>
              <Column align="center" className="w-20" key="github">
                <Link target="_blank" href="https://formbricks.com/github">
                  <Img
                    title="GitHub"
                    src="https://s3.eu-central-1.amazonaws.com/listmonk-formbricks/Github-transp.png"
                    alt="GitHub"
                    width="32"
                  />
                </Link>
              </Column>
              <Column align="left" key="discord">
                <Link target="_blank" href="https://formbricks.com/discord">
                  <Img
                    title="Discord"
                    src="https://s3.eu-central-1.amazonaws.com/listmonk-formbricks/Discord-transp.png"
                    alt="Discord"
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
      </Fragment>
    </Tailwind>
  </Html>
);
