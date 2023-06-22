import { Result } from "@formbricks/errors";
import { NetworkError } from "./errors";

// by using Brand, we can check that you can't pass to an environmentId a surveyId
type Brand<T, B> = T & { __brand: B };

export type EnvironmentId = Brand<string, "EnvironmentId">;
export type SurveyId = Brand<string, "SurveyId">;
export type PersonId = Brand<string, "PersonId">;
export type ResponseId = Brand<string, "ResponseId">;

export type KeyValueData = { [key: string]: string | number | string[] | number[] | undefined };

export type RequestFn = <T = any, E = any, Data = any>(
  path: string,
  data: Data,
  options?: RequestInit
) => Promise<Result<T, E | NetworkError | Error>>;

// https://github.com/formbricks/formbricks/blob/fbfc80dd4ed5d768f0c549e179fd1aa10edc400a/apps/web/lib/api/response.ts
export interface ApiErrorResponse {
  code: string;
  message: string;
  details: {
    [key: string]: string | string[] | number | number[] | boolean | boolean[];
  };
}
