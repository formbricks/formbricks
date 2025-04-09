"use client";

import { ResponseTable } from "@/app/(app)/environments/[environmentId]/engagements/[surveyId]/(analysis)/responses/components/ResponseTable";
import { TFnType, useTranslate } from "@tolgee/react";
import React from "react";
import { TEnvironment } from "@formbricks/types/environment";
import { TResponse, TResponseDataValue, TResponseTableData } from "@formbricks/types/responses";
import { TSurvey } from "@formbricks/types/surveys/types";
import { TTag } from "@formbricks/types/tags";
import { TUser } from "@formbricks/types/user";

interface ResponseDataViewProps {
  survey: TSurvey;
  responses: TResponse[];
  user?: TUser;
  environment: TEnvironment;
  environmentTags: TTag[];
  isReadOnly: boolean;
  fetchNextPage: () => void;
  hasMore: boolean;
  deleteResponses: (responseIds: string[]) => void;
  updateResponse: (responseId: string, updatedResponse: TResponse) => void;
  isFetchingFirstPage: boolean;
}

const formatAddressData = (responseValue: TResponseDataValue): Record<string, string> => {
  const addressKeys = ["addressLine1", "addressLine2", "city", "state", "zip", "country"];
  return Array.isArray(responseValue)
    ? responseValue.reduce((acc, curr, index) => {
        acc[addressKeys[index]] = curr || ""; // Fallback to empty string if undefined
        return acc;
      }, {})
    : {};
};

const formatContactInfoData = (responseValue: TResponseDataValue): Record<string, string> => {
  const addressKeys = ["firstName", "lastName", "email", "phone", "company"];
  return Array.isArray(responseValue)
    ? responseValue.reduce((acc, curr, index) => {
        acc[addressKeys[index]] = curr || ""; // Fallback to empty string if undefined
        return acc;
      }, {})
    : {};
};

const extractResponseData = (response: TResponse, survey: TSurvey): Record<string, any> => {
  let responseData: Record<string, any> = {};

  survey.questions.forEach((question) => {
    const responseValue = response.data[question.id];
    switch (question.type) {
      case "matrix":
        if (typeof responseValue === "object") {
          responseData = { ...responseData, ...responseValue };
        }
        break;
      case "address":
        responseData = { ...responseData, ...formatAddressData(responseValue) };
        break;
      case "contactInfo":
        responseData = { ...responseData, ...formatContactInfoData(responseValue) };
        break;
      default:
        responseData[question.id] = responseValue;
    }
  });

  survey.hiddenFields.fieldIds?.forEach((fieldId) => {
    responseData[fieldId] = response.data[fieldId];
  });

  return responseData;
};

const mapResponsesToTableData = (
  responses: TResponse[],
  survey: TSurvey,
  t: TFnType
): TResponseTableData[] => {
  return responses.map((response) => ({
    responseData: extractResponseData(response, survey),
    createdAt: response.createdAt,
    status: response.finished
      ? t("environments.surveys.responses.completed")
      : t("environments.surveys.responses.not_completed"),
    responseId: response.id,
    tags: response.tags,
    notes: response.notes,
    variables: survey.variables.reduce(
      (acc, curr) => {
        return Object.assign(acc, { [curr.id]: response.variables[curr.id] });
      },
      {} as Record<string, string | number>
    ),
    verifiedEmail: typeof response.data["verifiedEmail"] === "string" ? response.data["verifiedEmail"] : "",
    language: response.language,
    person: response.contact,
    contactAttributes: response.contactAttributes,
  }));
};

export const ResponseDataView: React.FC<ResponseDataViewProps> = ({
  survey,
  responses,
  user,
  environment,
  environmentTags,
  isReadOnly,
  fetchNextPage,
  hasMore,
  deleteResponses,
  updateResponse,
  isFetchingFirstPage,
}) => {
  const { t } = useTranslate();
  const data = mapResponsesToTableData(responses, survey, t);

  return (
    <div className="w-full">
      <ResponseTable
        data={data}
        survey={survey}
        responses={responses}
        user={user}
        environmentTags={environmentTags}
        isReadOnly={isReadOnly}
        environment={environment}
        fetchNextPage={fetchNextPage}
        hasMore={hasMore}
        deleteResponses={deleteResponses}
        updateResponse={updateResponse}
        isFetchingFirstPage={isFetchingFirstPage}
      />
    </div>
  );
};
