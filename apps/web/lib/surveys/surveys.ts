import useSWR from "swr";
import { fetcher } from "@formbricks/lib/fetcher";

export const useSurveys = (environmentId: string) => {
  const { data, error, mutate, isLoading } = useSWR(`/api/v1/environments/${environmentId}/surveys`, fetcher);

  return {
    surveys: data,
    isLoadingSurveys: isLoading,
    isErrorSurveys: error,
    mutateSurveys: mutate,
  };
};

export const useSurvey = (environmentId: string, id: string) => {
  const { data, error, mutate, isLoading } = useSWR(
    `/api/v1/environments/${environmentId}/surveys/${id}`,
    fetcher
  );

  return {
    survey: data,
    isLoadingSurvey: isLoading,
    isErrorSurvey: error,
    mutateSurvey: mutate,
  };
};

export const persistSurvey = async (survey) => {
  try {
    await fetch(`/api/v1/environments/${survey.environmentId}/surveys/${survey.id}/`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(survey),
    });
  } catch (error) {
    console.error(error);
  }
};

export const createSurvey = async (environmentId: string, survey = {}) => {
  try {
    const res = await fetch(`/api/v1/environments/${environmentId}/surveys`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(survey),
    });
    return await res.json();
  } catch (error) {
    console.error(error);
    throw Error(`createSurvey: unable to create survey: ${error.message}`);
  }
};

export const deleteSurvey = async (environmentId: string, surveyId: string) => {
  try {
    await fetch(`/api/v1/environments/${environmentId}/surveys/${surveyId}`, {
      method: "DELETE",
    });
  } catch (error) {
    console.error(error);
    throw Error(`deleteSurvey: unable to delete survey: ${error.message}`);
  }
};

export const getSurveyElementFieldSetter = (
  survey: any,
  mutateSurvey: (any, boolean?) => void,
  pageId: string,
  elementId: string
) => {
  return (input, field, parentField = "") =>
    setSurveyElementField(survey, mutateSurvey, pageId, elementId, input, field, parentField);
};

export const setSurveyElementField = (
  survey: any,
  mutateSurvey: (any, boolean?) => void,
  pageId: string,
  elementId: string,
  input: string | number,
  field: string,
  parentField: string = ""
) => {
  const updatedSurvey = JSON.parse(JSON.stringify(survey));
  const elementIdx = getSurveyPage(updatedSurvey, pageId).elements.findIndex((e) => e.id === elementId);
  if (typeof elementIdx === "undefined") {
    throw Error(`setSurveyElementField: unable to find element with id ${elementId}`);
  }
  if (parentField !== "") {
    getSurveyPage(updatedSurvey, pageId).elements[elementIdx][parentField][field] = input;
  } else {
    getSurveyPage(updatedSurvey, pageId).elements[elementIdx][field] = input;
  }
  mutateSurvey(updatedSurvey, false);
  return updatedSurvey;
};

export const getSurveyPage = (survey, pageId) => {
  const page = survey.pages.find((p) => p.id === pageId);
  if (typeof page === "undefined") {
    throw Error(`getSurveyPage: unable to find page with id ${pageId}`);
  }
  return page;
};

export const duplicateSurvey = async (environmentId: string, surveyId: string) => {
  try {
    const res = await fetch(`/api/v1/environments/${environmentId}/surveys/${surveyId}`);

    const originalSurvey = await res.json();
    const newSurvey = {
      ...originalSurvey,
      name: `${originalSurvey.name} (Copy)`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      status: "draft",
    };

    delete newSurvey.id;
    delete newSurvey.responses;
    delete newSurvey.displays;
    delete newSurvey.environmentId;
    delete newSurvey.responseRate;
    delete newSurvey.numDisplays;
    delete newSurvey.environment;
    delete newSurvey.triggers;

    const createdSurvey = await createSurvey(environmentId, newSurvey);
    return createdSurvey;
  } catch (error) {
    console.error(error);
    throw Error(`duplicateSurvey: unable to duplicate survey: ${error.message}`);
  }
};
