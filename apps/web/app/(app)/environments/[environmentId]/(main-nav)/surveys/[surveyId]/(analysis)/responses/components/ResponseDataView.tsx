"use client";

import { TFunction } from "i18next";
import React from "react";
import { useTranslation } from "react-i18next";
import { TEnvironment } from "@formbricks/types/environment";
import { TSurveyQuota } from "@formbricks/types/quota";
import { TResponseDataValue, TResponseTableData, TResponseWithQuotas } from "@formbricks/types/responses";
import { TSurvey } from "@formbricks/types/surveys/types";
import { TTag } from "@formbricks/types/tags";
import { TUser, TUserLocale } from "@formbricks/types/user";
import { ResponseTable } from "@/app/(app)/environments/[environmentId]/surveys/[surveyId]/(analysis)/responses/components/ResponseTable";
import { getElementsFromBlocks } from "@/modules/survey/lib/client-utils";

interface ResponseDataViewProps {
  survey: TSurvey;
  responses: TResponseWithQuotas[];
  user?: TUser;
  environment: TEnvironment;
  environmentTags: TTag[];
  isReadOnly: boolean;
  fetchNextPage: () => void;
  hasMore: boolean;
  updateResponseList: (responseIds: string[]) => void;
  updateResponse: (responseId: string, updatedResponse: TResponseWithQuotas) => void;
  isFetchingFirstPage: boolean;
  locale: TUserLocale;
  isQuotasAllowed: boolean;
  quotas: TSurveyQuota[];
}

// Helper function to format array values to record with specified keys
const formatArrayToRecord = (responseValue: TResponseDataValue, keys: string[]): Record<string, string> => {
  if (!Array.isArray(responseValue)) return {};
  const result: Record<string, string> = {};
  for (let index = 0; index < responseValue.length; index++) {
    const curr = responseValue[index];
    result[keys[index]] = curr || "";
  }
  return result;
};

// Export for testing
export const formatAddressData = (responseValue: TResponseDataValue): Record<string, string> => {
  const addressKeys = ["addressLine1", "addressLine2", "city", "state", "zip", "country"];
  return formatArrayToRecord(responseValue, addressKeys);
};

// Export for testing
export const formatContactInfoData = (responseValue: TResponseDataValue): Record<string, string> => {
  const contactInfoKeys = ["firstName", "lastName", "email", "phone", "company"];
  return formatArrayToRecord(responseValue, contactInfoKeys);
};

// Export for testing
export const extractResponseData = (response: TResponseWithQuotas, survey: TSurvey): Record<string, any> => {
  const responseData: Record<string, any> = {};

  const elements = getElementsFromBlocks(survey.blocks);

  for (const element of elements) {
    const responseValue = response.data[element.id];
    switch (element.type) {
      case "matrix":
        if (typeof responseValue === "object") {
          Object.assign(responseData, responseValue);
        }
        break;
      case "address":
        Object.assign(responseData, formatAddressData(responseValue));
        break;
      case "contactInfo":
        Object.assign(responseData, formatContactInfoData(responseValue));
        break;
      default:
        responseData[element.id] = responseValue;
    }
  }

  if (survey.hiddenFields.fieldIds) {
    for (const fieldId of survey.hiddenFields.fieldIds) {
      responseData[fieldId] = response.data[fieldId];
    }
  }

  return responseData;
};

// Export for testing
const mapResponsesToTableData = (
  responses: TResponseWithQuotas[],
  survey: TSurvey,
  t: TFunction
): TResponseTableData[] => {
  return responses.map((response) => ({
    responseData: extractResponseData(response, survey),
    createdAt: response.createdAt,
    status: response.finished
      ? t("environments.surveys.responses.completed")
      : t("environments.surveys.responses.not_completed"),
    responseId: response.id,
    singleUseId: response.singleUseId,
    tags: response.tags,
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
    meta: response.meta,
    quotas: response.quotas?.map((quota) => quota.name),
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
  updateResponseList,
  updateResponse,
  isFetchingFirstPage,
  locale,
  isQuotasAllowed,
  quotas,
}) => {
  const { t } = useTranslation();
  const [selectedResponseId, setSelectedResponseId] = React.useState<string | null>(null);
  const setSelectedResponseIdTransition = React.useCallback((id: string | null) => {
    React.startTransition(() => setSelectedResponseId(id));
  }, []);
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
        updateResponseList={updateResponseList}
        updateResponse={updateResponse}
        isFetchingFirstPage={isFetchingFirstPage}
        locale={locale}
        isQuotasAllowed={isQuotasAllowed}
        quotas={quotas}
        selectedResponseId={selectedResponseId}
        setSelectedResponseId={setSelectedResponseIdTransition}
      />
    </div>
  );
};
