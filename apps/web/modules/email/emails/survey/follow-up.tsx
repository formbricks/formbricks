import { Body, Container, Html, Img, Link, Section, Tailwind, Text } from "@react-email/components";
import dompurify from "isomorphic-dompurify";
import { IMPRINT_ADDRESS, IMPRINT_URL, PRIVACY_URL } from "@formbricks/lib/constants";

interface FollowUpEmailProps {
  html: string;
  logoUrl?: string;
}

export function FollowUpEmail({ html, logoUrl }: FollowUpEmailProps): React.JSX.Element {
  return (
    <Html>
      <Tailwind>
        <Body
          className="m-0 h-full w-full justify-center bg-slate-50 p-6 text-center text-base font-medium text-slate-800"
          style={{
            fontFamily: "'Jost', 'Helvetica Neue', 'Segoe UI', 'Helvetica', 'sans-serif'",
          }}>
          {logoUrl && (
            <Section>
              <Img alt="Logo" className="mx-auto max-h-[100px] w-80 object-contain" src={logoUrl} />
            </Section>
          )}
          <Container className="mx-auto my-8 max-w-xl rounded-md bg-white p-4 text-left">
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
            <Text className="m-0 font-normal text-slate-500">powered by Formbricks</Text>

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
