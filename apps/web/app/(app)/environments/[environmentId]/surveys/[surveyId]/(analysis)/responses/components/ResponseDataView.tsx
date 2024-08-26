import React from "react";
import { TEnvironment } from "@formbricks/types/environment";
import { TResponse } from "@formbricks/types/responses";
import { TSurvey } from "@formbricks/types/surveys/types";
import { TTag } from "@formbricks/types/tags";
import { TUser } from "@formbricks/types/user";
import { DataTable } from "./DataTable";

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
}

export const ResponseDataView = ({
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
}: ResponseDataViewProps) => {
  const getResponseData = (response: TResponse, survey: TSurvey) => {
    let responseData = {};

    survey.questions.forEach((question) => {
      const responseValue = response.data[question.id];

      switch (question.type) {
        case "matrix":
          if (typeof responseValue === "object") {
            responseData = { ...responseData, ...responseValue };
          }
          break;

        case "address":
          // Assume responseValue is an array with specific order
          const addressKeys = ["addressLine1", "addressLine2", "city", "state", "zip", "country"];
          const addressData = Array.isArray(responseValue)
            ? responseValue.reduce((acc, curr, index) => {
                acc[addressKeys[index]] = curr || ""; // Fallback to empty string if undefined
                return acc;
              }, {})
            : {};
          responseData = { ...responseData, ...addressData };
          break;

        default:
          // Assign all other types directly
          responseData[question.id] = responseValue;
      }
    });
    survey.hiddenFields.fieldIds?.forEach((fieldId) => {
      const responseValue = response.data[fieldId];
      responseData[fieldId] = responseValue;
    });

    return responseData;
  };

  const getData = () => {
    return responses.map((response) => ({
      ...getResponseData(response, survey),
      createdAt: response.createdAt,
      status: response.finished ? "Completed ✅" : "Not Completed ⏳",
      responseId: response.id,
      tags: response.tags,
      notes: response.notes,
      verifiedEmail: typeof response.data["verifiedEmail"] === "string" ? response.data["verifiedEmail"] : "",
      language: response.language,
    }));
  };

  const data = getData();

  return (
    <div className="container mx-auto">
      <DataTable
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
      />
    </div>
  );
};
