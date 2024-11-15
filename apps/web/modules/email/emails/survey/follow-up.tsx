import { Body, Container, Html, Link, Section, Tailwind } from "@react-email/components";
import { sanitize } from "isomorphic-dompurify";

interface FollowUpEmailProps {
  surveyName: string;
  html: string;
}

export function FollowUpEmail({ html }: FollowUpEmailProps): React.JSX.Element {
  return (
    <Html>
      <Tailwind>
        <Body
          className="m-0 h-full w-full justify-center bg-slate-50 p-6 text-center text-base font-medium text-slate-800"
          style={{
            fontFamily: "'Jost', 'Helvetica Neue', 'Segoe UI', 'Helvetica', 'sans-serif'",
          }}>
          <Container className="mx-auto my-8 max-w-xl bg-white p-4 text-left">
            <div dangerouslySetInnerHTML={{ __html: sanitize(html) }} />
          </Container>

          <Section className="mt-4 text-center">
            powered by Formbricks
            <br />
            <span className="text-xs">
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
            </span>
          </Section>
        </Body>
      </Tailwind>
    </Html>
  );
}
