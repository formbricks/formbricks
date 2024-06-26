import { Logger } from "./logger";

export type { ZErrorHandler } from "@formbricks/types/errors";

export type ResultError<T> = { ok: false; error: T };

export type ResultOk<T> = { ok: true; value: T };

export type Result<T, E = Error> = ResultOk<T> | ResultError<E>;

export const ok = <T, E>(value: T): Result<T, E> => ({ ok: true, value });

export const okVoid = <E>(): Result<void, E> => ({ ok: true, value: undefined });

export const err = <E = Error>(error: E): ResultError<E> => ({
  ok: false,
  error,
});

export const wrap =
  <T, R>(fn: (value: T) => R) =>
  (result: Result<T>): Result<R> =>
    result.ok === true ? { ok: true, value: fn(result.value) } : result;

export function match<TSuccess, TError, TReturn>(
  result: Result<TSuccess, TError>,
  onSuccess: (value: TSuccess) => TReturn,
  onError: (error: TError) => TReturn
) {
  if (result.ok === true) {
    return onSuccess(result.value);
  }

  return onError(result.error);
}

/* 
Usage: 
const test = () => {
  throw new Error("test");
};
  
const result = wrapThrows(test)();
if (result.ok === true) {
  console.log(result.value);
} else {
  console.log(result.error);
}
*/
export const wrapThrows =
  <T, A extends any[]>(fn: (...args: A) => T) =>
  (...args: A): Result<T> => {
    try {
      return {
        ok: true,
        value: fn(...args),
      };
    } catch (error) {
      return {
        ok: false,
        error: error as Error,
      };
    }
  };

export type NetworkError = {
  code: "network_error";
  status: number;
  message: string;
  url: string;
  responseMessage: string;
};

export type MissingFieldError = {
  code: "missing_field";
  field: string;
};

export type InvalidMatchTypeError = {
  code: "invalid_match_type";
  message: string;
};

export type MissingPersonError = {
  code: "missing_person";
  message: string;
};

export type NotInitializedError = {
  code: "not_initialized";
  message: string;
};

export type AttributeAlreadyExistsError = {
  code: "attribute_already_exists";
  message: string;
};

export type InvalidCodeError = {
  code: "invalid_code";
  message: string;
};

const logger = Logger.getInstance();

export class ErrorHandler {
  private static instance: ErrorHandler | null;
  private handleError: (error: any) => void;
  public customized: boolean = false;
  public static initialized = false;

  private constructor(errorHandler?: (error: any) => void) {
    if (errorHandler) {
      this.handleError = errorHandler;
      this.customized = true;
    } else {
      this.handleError = (err) => Logger.getInstance().error(JSON.stringify(err));
    }
  }

  static getInstance(): ErrorHandler {
    if (!ErrorHandler.instance) {
      ErrorHandler.instance = new ErrorHandler();
    }

    return ErrorHandler.instance;
  }

  static init(errorHandler?: (error: any) => void): void {
    this.initialized = true;

    ErrorHandler.instance = new ErrorHandler(errorHandler);
  }

  public printStatus(): void {
    logger.debug(`Custom error handler: ${this.customized ? "yes" : "no"}`);
  }

  public handle(error: any): void {
    console.warn("🧱 Formbricks - Global error: ", error);
    this.handleError(error);
  }
}
