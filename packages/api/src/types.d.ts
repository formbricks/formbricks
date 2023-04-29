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

export interface IEnvironmentId {
  environmentId: EnvironmentId;
}
