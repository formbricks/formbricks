import { Result } from "./result";

/**
 * Applies the given function `fn` to the data property of the input `result` object
 * and returns a new `Result` object with the transformed data property.
 *
 * @template T The type of the input data.
 * @template R The type of the output data.
 *
 * @param {function(value: T): R} fn The function to apply to the data property of the input `result` object.
 * @returns {function(result: Result<T>): Result<R>} A new function that takes in a `Result<T>` object and returns a new `Result<R>` object.
 *
 * @example
 * const divideByTwo = (num: number): Result<number> => {
 *   if (num === 0) {
 *     return { ok: false, error: "Cannot divide zero" };
 *   }
 *
 *   return { ok: true, data: num / 2 };
 * }
 *
 * const wrappedDivideByTwo = wrap(divideByTwo);
 *
 * const result1: Result<number> = { ok: true, data: 10 };
 * const result2: Result<number> = { ok: false, error: "Invalid input" };
 * const result3: Result<number> = { ok: true, data: 0 };
 *
 * console.log(wrappedDivideByTwo(result1)); // { ok: true, data: 5 }
 * console.log(wrappedDivideByTwo(result2)); // { ok: false, error: "Invalid input" }
 * console.log(wrappedDivideByTwo(result3)); // { ok: false, error: "Cannot divide zero" }
 */

export const wrap =
  <T, R>(fn: (value: T) => R) =>
  (result: Result<T>): Result<R> =>
    result.ok === true ? { ok: true, data: fn(result.data) } : result;

/**
 * Matches the given `result` object against its `ok` property and invokes the `onSuccess` function
 * if `ok` is `true`, or the `onError` function if `ok` is `false`. Returns the result of the invoked function. Match a Result object and run a function depending on the result.
 *
 * @template TSuccess - Type of the success value
 * @template TError - Type of the error value
 * @template TReturn - Type of the return value
 *
 * @param {Result<TSuccess, TError>} result The `Result` object to match against.
 * @param {(value: TSuccess) => TReturn} onSuccess The function to invoke if `result.ok` is `true`.
 * @param {(error: TError) => TReturn} onError The function to invoke if `result.ok` is `false`.
 *
 * @returns {TReturn} The result of the invoked function.
 *
 * @example
 * const test = (): Result<string, Error> => {
 *  return err(new Error("error happened"));
 * }
 *
 * const result = test();
 *
 * match(result, (value) => {
 *  console.log(value); // never run with this example
 * }, (error) => {
 *  console.log(error); // Error: error happened
 * });
 */
export function match<TSuccess, TError, TReturn>(
  result: Result<TSuccess, TError>,
  onSuccess: (value: TSuccess) => TReturn,
  onError: (error: TError) => TReturn
): TReturn {
  if (result.ok === true) {
    return onSuccess(result.data);
  }

  return onError(result.error);
}

/**
 * Wraps a function `fn` that may throw an error into a new function that returns a `Result` object.
 * If the wrapped function throws an error, the returned `Result` object will have an `ok` property of `false`
 * and an `error` property containing the thrown error. Otherwise, the returned `Result` object will have an
 * `ok` property of `true` and a `data` property containing the result of the wrapped function.
 *
 * @template T The type of the result value.
 * @template A An array of the types of the arguments expected by the wrapped function.
 *
 * @param {(...args: A) => T} fn The function to wrap.
 * @returns {(...args: A) => Result<T>} A new function that returns a `Result` object.
 *
 * @example
 * function divideByTwo(num: number): number {
 *   if (num === 0) {
 *     throw new Error("Cannot divide zero");
 *   }
 *   return num / 2;
 * }
 *
 * const wrappedDivideByTwo = wrapThrows(divideByTwo);
 *
 * const result1: Result<number> = wrappedDivideByTwo(10); // { ok: true, data: 5 }
 * const result2: Result<number> = wrappedDivideByTwo(0); // { ok: false, error: Error("Cannot divide zero") }
 */
export const wrapThrows =
  <T, A extends any[]>(fn: (...args: A) => T): ((...args: A) => Result<T>) =>
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
