export const getResponsesCacheTag = (surveyId: string) => `surveys-${surveyId}-responses`;

export const getResponseCacheTag = (responseId: string) => `responses-${responseId}`;

export const getEnvironmentResponsesCacheTag = (environmentId: string): string =>
  `environments-${environmentId}-responses`;

export const getResponsesByPersonIdCacheTags = (personId: string): string => `person-${personId}-responses`;

/*
ISSUES
1. Pagination - how do we deal with findMany that are cached where page can be undefined
2. How do we make sure tags are not duplicated in multiple functions

3. How do we avoid writing long function names.
The below proposal addresses this:

serviceName + CacheTag

Then every object within it begins with `by` and the dependency
*/
export const responseCacheTag = {
  single(responseId: string) {
    return `responses-${responseId}`;
  },
  bySurveyId(surveyId: string) {
    return `surveys-${surveyId}-responses`;
  },
  byPersonId(personId: string) {
    return `person-${personId}-responses`;
  },
  byEnvironmentId(environmentId: string) {
    return `environments-${environmentId}-responses`;
  },
};
