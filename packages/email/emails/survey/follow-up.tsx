import { Container, Text } from "@react-email/components";
import { EmailTemplate } from "../../components/email-template";

interface FollowUpEmailProps {
  surveyName: string;
  html: string;
}

export function FollowUpEmail({ html, surveyName }: FollowUpEmailProps): React.JSX.Element {
  return (
    <EmailTemplate>
      <Container>
        <Text className="mb-1">
          You have receieved a follow up email from the survey: <strong>{surveyName}</strong>
        </Text>
      </Container>

      <div dangerouslySetInnerHTML={{ __html: html }} />
    </EmailTemplate>
  );
}
