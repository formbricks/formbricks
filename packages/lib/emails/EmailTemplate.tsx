import { Body, Column, Container, Html, Img, Link, Row, Section } from "@react-email/components";
import { Tailwind } from "@react-email/components";
import React from "react";

export const EmailTemplate = ({ content }) => (
  <Html>
    <Tailwind>
      <Body
        className="h-full w-full justify-center bg-slate-50 p-6 text-center"
        style={{
          backgroundColor: "#f1f5f9",
          fontFamily: "'Poppins', 'Helvetica Neue', 'Segoe UI', 'Helvetica', 'sans-serif'",
          fontSize: "15px",
          fontWeight: "500",
          lineHeight: "26px",
          margin: "0",
          color: "#1e293b",
        }}>
        <Section className="flex items-center justify-center">
          <Link href="https://formbricks.com?utm_source=email_header&utm_medium=email" target="_blank">
            <Img
              src="https://s3.eu-central-1.amazonaws.com/listmonk-formbricks/Formbricks-Light-transparent.png"
              alt="Formbricks Logo"
              className="w-80"
            />
          </Link>
        </Section>
        <Container className="mx-auto my-8 max-w-xl bg-white p-4 text-left">{content}</Container>

        <Section>
          <Row>
            <Column align="right">
              <Link target="_blank" href="https://twitter.com/formbricks">
                <Img
                  title="Twitter"
                  src="https://s3.eu-central-1.amazonaws.com/listmonk-formbricks/Twitter-transp.png"
                  alt="Tw"
                  width="32"
                />
              </Link>
            </Column>
            <Column align="center" className="w-20">
              <Link target="_blank" href="https://formbricks.com/github">
                <Img
                  title="GitHub"
                  src="https://s3.eu-central-1.amazonaws.com/listmonk-formbricks/Github-transp.png"
                  alt="GitHub"
                  width="32"
                />
              </Link>
            </Column>
            <Column align="left">
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
    </Tailwind>
  </Html>
);
