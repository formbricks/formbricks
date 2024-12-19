import { Body, Container, Html, Link, Section, Tailwind } from "@react-email/components";
import dompurify from "isomorphic-dompurify";
import { IMPRINT_URL, PRIVACY_URL } from "@formbricks/lib/constants";

interface FollowUpEmailProps {
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
            <div
              dangerouslySetInnerHTML={{
                __html: dompurify.sanitize(html, {
                  ALLOWED_TAGS: ["p", "span", "b", "strong", "i", "em", "a", "br"],
                  ALLOWED_ATTR: ["href", "rel", "dir", "class"],
                  ALLOWED_URI_REGEXP: /^https?:\/\//, // Only allow safe URLs starting with http or https
                  ADD_ATTR: ["target"], // Optional: Allow 'target' attribute for links (e.g., _blank)
                }),
              }}
            />
          </Container>

          <Section className="mt-4 text-center text-sm">
            powered by Formbricks
            <br />
            <Link href={IMPRINT_URL} target="_blank" rel="noopener noreferrer">
              Imprint
            </Link>{" "}
            |{" "}
            <Link href={PRIVACY_URL} target="_blank" rel="noopener noreferrer">
              Privacy Policy
            </Link>
          </Section>
        </Body>
      </Tailwind>
    </Html>
  );
}
