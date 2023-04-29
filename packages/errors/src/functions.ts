import { Result } from "./result";

export const wrap =
  <T, R>(fn: (value: T) => R) =>
  (result: Result<T>): Result<R> =>
    result.ok === true ? { ok: true, data: fn(result.data) } : result;
    
/* Usage:
const test = (): Result<..., ...> => {
    return err({ code: "..." })
}

match(test(), (value) => {}, (error) => {})
*/
export function match<TSuccess, TError, TReturn>(
  result: Result<TSuccess, TError>,
  onSuccess: (value: TSuccess) => TReturn,
  onError: (error: TError) => TReturn
) {
  if (result.ok === true) {
    return onSuccess(result.data);
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
        data: fn(...args),
      };
    } catch (error: any) {
      return {
        ok: false,
        error,
      };
    }
  };
