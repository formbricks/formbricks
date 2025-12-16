import { Column, Hr, Row, Text } from "@react-email/components";
import { TSurveyElementTypeEnum } from "@formbricks/types/surveys/elements";
import { EmailTemplate } from "@/src/components/email-template";
import { renderEmailResponseValue } from "@/src/lib/email-utils";
import { t as mockT } from "@/src/lib/mock-translate";

type TFunction = (key: string, replacements?: Record<string, string>) => string;

// Processed data types - web app does all the processing
interface ProcessedResponseElement {
  element: string;
  response: string | string[];
  type: TSurveyElementTypeEnum;
}

interface ProcessedVariable {
  id: string;
  name: string;
  type: "text" | "number";
  value: string | number;
}

interface ProcessedHiddenField {
  id: string;
  value: string;
}

export interface FollowUpEmailProps {
  readonly body: string; // Already processed HTML with recall tags replaced
  readonly responseData?: ProcessedResponseElement[]; // Already mapped elements
  readonly variables?: ProcessedVariable[]; // Already filtered variables
  readonly hiddenFields?: ProcessedHiddenField[]; // Already filtered hidden fields
  readonly logoUrl?: string;
  readonly t?: TFunction;
}

export function FollowUpEmail({
  body,
  responseData = [],
  variables = [],
  hiddenFields = [],
  logoUrl,
  t = mockT,
}: FollowUpEmailProps): React.JSX.Element {
  return (
    <EmailTemplate logoUrl={logoUrl} t={t}>
      <>
        <div dangerouslySetInnerHTML={{ __html: body }} />

        {responseData.length > 0 ? (
          <>
            <Hr />
            <Text className="mb-4 text-base font-semibold text-slate-900">{t("emails.response_data")}</Text>
          </>
        ) : null}

        {responseData.map((e) => {
          if (!e.response) return null;
          return (
            <Row key={e.element}>
              <Column className="w-full">
                <Text className="mb-2 text-sm font-semibold text-slate-900">{e.element}</Text>
                {renderEmailResponseValue(e.response, e.type, t, true)}
              </Column>
            </Row>
          );
        })}

        {variables.map((variable) => (
          <Row key={variable.id}>
            <Column className="w-full">
              <Text className="mb-2 text-sm font-semibold text-slate-900">
                {variable.type === "number"
                  ? `${t("emails.number_variable")}: ${variable.name}`
                  : `${t("emails.text_variable")}: ${variable.name}`}
              </Text>
              <Text className="mt-0 whitespace-pre-wrap break-words text-sm text-slate-700">
                {variable.value}
              </Text>
            </Column>
          </Row>
        ))}

        {hiddenFields.map((hiddenField) => (
          <Row key={hiddenField.id}>
            <Column className="w-full">
              <Text className="mb-2 text-sm font-semibold text-slate-900">
                {t("emails.hidden_field")}: {hiddenField.id}
              </Text>
              <Text className="mt-0 whitespace-pre-wrap break-words text-sm text-slate-700">
                {hiddenField.value}
              </Text>
            </Column>
          </Row>
        ))}
      </>
    </EmailTemplate>
  );
}

// Default export for preview server with example data
export default function FollowUpEmailPreview(): React.JSX.Element {
  return (
    <FollowUpEmail
      body="<p>Thank you for your feedback! We've received your response and will review it shortly.</p><p>Here's a summary of what you submitted:</p>"
      responseData={[
        {
          element: "What did you like most?",
          response: "The customer service was excellent!",
          type: TSurveyElementTypeEnum.OpenText,
        },
        {
          element: "How would you rate your experience?",
          response: "5",
          type: TSurveyElementTypeEnum.Rating,
        },
      ]}
      variables={[
        {
          id: "var-1",
          name: "Customer ID",
          type: "text",
          value: "CUST-456",
        },
      ]}
      hiddenFields={[
        {
          id: "userId",
          value: "user-abc-123",
        },
      ]}
      logoUrl="https://app.formbricks.com/logo.png"
    />
  );
}
