import { getAttributeClasses } from "@formbricks/lib/attributeClass/service";
import { SERVICES_REVALIDATION_INTERVAL } from "@formbricks/lib/constants";
import { displayCache } from "@formbricks/lib/display/cache";
import { getDisplaysByPersonId } from "@formbricks/lib/display/service";
import { getProductByEnvironmentIdCached, getProductCacheTag } from "@formbricks/lib/product/service";
import { getSurveyCacheTag, getSurveys } from "@formbricks/lib/survey/service";
import { TSurveyWithTriggers } from "@formbricks/types/js";
import { TPerson } from "@formbricks/types/people";
import { unstable_cache } from "next/cache";

// Helper function to calculate difference in days between two dates
const diffInDays = (date1: Date, date2: Date) => {
  const diffTime = Math.abs(date2.getTime() - date1.getTime());
  return Math.floor(diffTime / (1000 * 60 * 60 * 24));
};

export const getSyncSurveysCached = (environmentId: string, person: TPerson) =>
  unstable_cache(
    async () => {
      return await getSyncSurveys(environmentId, person);
    },
    [`getSyncSurveysCached-${environmentId}-${person.id}`],
    {
      tags: [
        displayCache.tag.byPersonId(person.id),
        getSurveyCacheTag(environmentId),
        getProductCacheTag(environmentId),
      ],
      revalidate: SERVICES_REVALIDATION_INTERVAL,
    }
  )();

export const getSyncSurveys = async (
  environmentId: string,
  person: TPerson
): Promise<TSurveyWithTriggers[]> => {
  // get recontactDays from product
  const product = await getProductByEnvironmentIdCached(environmentId);

  if (!product) {
    throw new Error("Product not found");
  }

  let surveys = await getSurveys(environmentId);

  // filtered surveys for running and web
  surveys = surveys.filter((survey) => survey.status === "inProgress" && survey.type === "web");

  const displays = await getDisplaysByPersonId(person.id);

  // filter surveys that meet the displayOption criteria
  surveys = surveys.filter((survey) => {
    if (survey.displayOption === "respondMultiple") {
      return true;
    } else if (survey.displayOption === "displayOnce") {
      return displays.filter((display) => display.surveyId === survey.id).length === 0;
    } else if (survey.displayOption === "displayMultiple") {
      return (
        displays.filter((display) => display.surveyId === survey.id && display.responseId !== null).length ===
        0
      );
    } else {
      throw Error("Invalid displayOption");
    }
  });

  const attributeClasses = await getAttributeClasses(environmentId);

  // filter surveys that meet the attributeFilters criteria
  const potentialSurveysWithAttributes = surveys.filter((survey) => {
    const attributeFilters = survey.attributeFilters;
    if (attributeFilters.length === 0) {
      return true;
    }
    // check if meets all attribute filters criterias
    return attributeFilters.every((attributeFilter) => {
      const attributeClassName = attributeClasses.find(
        (attributeClass) => attributeClass.id === attributeFilter.attributeClassId
      )?.name;
      if (!attributeClassName) {
        throw Error("Invalid attribute filter class");
      }
      const personAttributeValue = person.attributes[attributeClassName];
      if (attributeFilter.condition === "equals") {
        return personAttributeValue === attributeFilter.value;
      } else if (attributeFilter.condition === "notEquals") {
        return personAttributeValue !== attributeFilter.value;
      } else {
        throw Error("Invalid attribute filter condition");
      }
    });
  });

  const latestDisplay = displays[0];

  // filter surveys that meet the recontactDays criteria
  surveys = potentialSurveysWithAttributes.filter((survey) => {
    if (!latestDisplay) {
      return true;
    } else if (survey.recontactDays !== null) {
      const lastDisplaySurvey = displays.filter((display) => display.surveyId === survey.id)[0];
      if (!lastDisplaySurvey) {
        return true;
      }
      return diffInDays(new Date(), new Date(lastDisplaySurvey.createdAt)) >= survey.recontactDays;
    } else if (product.recontactDays !== null) {
      return diffInDays(new Date(), new Date(latestDisplay.createdAt)) >= product.recontactDays;
    } else {
      return true;
    }
  });

  return surveys;
};
