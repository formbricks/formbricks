import { ResponseTable } from "@/app/(app)/environments/[environmentId]/surveys/[surveyId]/(analysis)/responses/components/ResponseTable";
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
  isViewer: boolean;
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
      default:
        responseData[question.id] = responseValue;
    }
  });

  survey.hiddenFields.fieldIds?.forEach((fieldId) => {
    responseData[fieldId] = response.data[fieldId];
  });

  return responseData;
};

const mapResponsesToTableData = (responses: TResponse[], survey: TSurvey): TResponseTableData[] => {
  return responses.map((response) => ({
    responseData: extractResponseData(response, survey),
    createdAt: response.createdAt,
    status: response.finished ? "Completed ✅" : "Not Completed ⏳",
    responseId: response.id,
    tags: response.tags,
    notes: response.notes,
    verifiedEmail: typeof response.data["verifiedEmail"] === "string" ? response.data["verifiedEmail"] : "",
    language: response.language,
    person: response.person,
    personAttributes: response.personAttributes,
  }));
};

export const ResponseDataView: React.FC<ResponseDataViewProps> = ({
  survey,
  responses,
  user,
  environment,
  environmentTags,
  isViewer,
  fetchNextPage,
  hasMore,
  deleteResponses,
  updateResponse,
  isFetchingFirstPage,
}) => {
  const data = mapResponsesToTableData(responses, survey);

  return (
    <div className="w-full">
      <ResponseTable
        data={data}
        survey={survey}
        responses={responses}
        user={user}
        environmentTags={environmentTags}
        isViewer={isViewer}
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
