import { Column, Hr, Row, Text } from "@react-email/components";
import React from "react";
import sanitizeHtml from "sanitize-html";
import { TSurveyFollowUp } from "@formbricks/database/types/survey-follow-up";
import { TResponse } from "@formbricks/types/responses";
import { TSurvey } from "@formbricks/types/surveys/types";
import { getElementResponseMapping } from "@/lib/responses";
import { parseRecallInfo } from "@/lib/utils/recall";
import { getTranslate } from "@/lingodotdev/server";
import { EmailTemplate } from "@/modules/email/components/email-template";
import { renderEmailResponseValue } from "@/modules/email/emails/lib/utils";

interface FollowUpEmailProps {
  readonly followUp: TSurveyFollowUp;
  readonly logoUrl?: string;
  readonly attachResponseData: boolean;
  readonly includeVariables: boolean;
  readonly includeHiddenFields: boolean;
  readonly survey: TSurvey;
  readonly response: TResponse;
}

export async function FollowUpEmail(props: FollowUpEmailProps): Promise<React.JSX.Element> {
  const { properties } = props.followUp.action;
  let { body } = properties;

  // Parse recall tags and replace with actual response values
  body = parseRecallInfo(body, props.response.data, props.response.variables);

  const elements = props.attachResponseData ? getElementResponseMapping(props.survey, props.response) : [];
  const t = await getTranslate();

  return (
    <EmailTemplate logoUrl={props.logoUrl} t={t}>
      <>
        <div
          dangerouslySetInnerHTML={{
            __html: sanitizeHtml(body, {
              allowedTags: ["p", "span", "b", "strong", "i", "em", "a", "br"],
              allowedAttributes: {
                a: ["href", "rel", "target"],
                "*": ["dir", "class"],
              },
              allowedSchemes: ["http", "https"],
              allowedSchemesByTag: {
                a: ["http", "https"],
              },
            }),
          }}
        />

        {elements.length > 0 ? (
          <>
            <Hr />
            <Text className="mb-4 text-base font-semibold text-slate-900">{t("emails.response_data")}</Text>
          </>
        ) : null}

        {elements.map((e) => {
          if (!e.response) return;
          return (
            <Row key={e.element}>
              <Column className="w-full">
                <Text className="mb-2 text-sm font-semibold text-slate-900">{e.element}</Text>
                {renderEmailResponseValue(e.response, e.type, t, true)}
              </Column>
            </Row>
          );
        })}

        {props.attachResponseData &&
          props.includeVariables &&
          props.survey.variables
            .filter((variable) => {
              const variableResponse = props.response.variables[variable.id];
              if (typeof variableResponse !== "string" && typeof variableResponse !== "number") {
                return false;
              }

              return variableResponse !== undefined;
            })
            .map((variable) => {
              const variableResponse = props.response.variables[variable.id];
              return (
                <Row key={variable.id}>
                  <Column className="w-full">
                    <Text className="mb-2 text-sm font-semibold text-slate-900">
                      {variable.type === "number"
                        ? `${t("emails.number_variable")}: ${variable.name}`
                        : `${t("emails.text_variable")}: ${variable.name}`}
                    </Text>
                    <Text className="mt-0 text-sm break-words whitespace-pre-wrap text-slate-700">
                      {variableResponse}
                    </Text>
                  </Column>
                </Row>
              );
            })}

        {props.attachResponseData &&
          props.includeHiddenFields &&
          props.survey.hiddenFields.fieldIds
            ?.filter((hiddenFieldId) => {
              const hiddenFieldResponse = props.response.data[hiddenFieldId];
              return hiddenFieldResponse && typeof hiddenFieldResponse === "string";
            })
            .map((hiddenFieldId) => {
              const hiddenFieldResponse = props.response.data[hiddenFieldId] as string;
              return (
                <Row key={hiddenFieldId}>
                  <Column className="w-full">
                    <Text className="mb-2 text-sm font-semibold text-slate-900">
                      {t("emails.hidden_field")}: {hiddenFieldId}
                    </Text>
                    <Text className="mt-0 text-sm break-words whitespace-pre-wrap text-slate-700">
                      {hiddenFieldResponse}
                    </Text>
                  </Column>
                </Row>
              );
            })}
      </>
    </EmailTemplate>
  );
}
