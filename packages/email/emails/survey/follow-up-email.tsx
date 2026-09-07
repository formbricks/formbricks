import { Column, Hr, Row, Text } from "@react-email/components";
import { EmailTemplate } from "../../src/components/email-template";
import { renderEmailResponseValue } from "../../src/lib/email-utils";
import { exampleData } from "../../src/lib/example-data";
import { t as mockT } from "../../src/lib/mock-translate";
import { TEmailTemplateLegalProps } from "../../src/types/email";
import { ProcessedHiddenField, ProcessedResponseElement, ProcessedVariable } from "../../src/types/follow-up";
import { TFunction } from "../../src/types/translations";

export interface FollowUpEmailProps extends TEmailTemplateLegalProps {
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
  ...legalProps
}: FollowUpEmailProps): React.JSX.Element {
  return (
    <EmailTemplate logoUrl={logoUrl} t={t} {...legalProps}>
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
              <Text className="mt-0 text-sm break-words whitespace-pre-wrap text-slate-700">
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
              <Text className="mt-0 text-sm break-words whitespace-pre-wrap text-slate-700">
                {hiddenField.value}
              </Text>
            </Column>
          </Row>
        ))}
      </>
    </EmailTemplate>
  );
}

export default function FollowUpEmailPreview(): React.JSX.Element {
  return <FollowUpEmail {...(exampleData.followUpEmail as unknown as FollowUpEmailProps)} />;
}
