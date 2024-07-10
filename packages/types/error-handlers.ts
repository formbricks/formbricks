export type Result<T, E = Error> = { ok: true; data: T } | { ok: false; error: E };

export const ok = <T, E>(data: T): Result<T, E> => ({ ok: true, data });

export const okVoid = <E>(): Result<void, E> => ({ ok: true, data: undefined });

export const err = <E = Error>(error: E): Result<never, E> => ({
  ok: false,
  error,
});

// Applies the given function `fn` to the data property of the input `result` object
// and returns a new `Result` object with the transformed data property.
//
// T - The type of the input data.
// R - The type of the output data.
//
// fn - The function to apply to the data property of the input `result` object.
// Returns a new function that takes in a `Result<T>` object and returns a new `Result<R>` object.
//
//
// Example:
// const divideByTwo = (num: number): Result<number> => {
//   if (num === 0) {
//     return { ok: false, error: "Cannot divide zero" };
//   }
//
//   return { ok: true, data: num / 2 };
// }
//
// const wrappedDivideByTwo = wrap(divideByTwo);
//
// const result1: Result<number> = { ok: true, data: 10 };
// const result2: Result<number> = { ok: false, error: "Invalid input" };
// const result3: Result<number> = { ok: true, data: 0 };
//
// console.log(wrappedDivideByTwo(result1)); // { ok: true, data: 5 }
// console.log(wrappedDivideByTwo(result2)); // { ok: false, error: "Invalid input" }
// console.log(wrappedDivideByTwo(result3)); // { ok: false, error: "Cannot divide zero" }
export const wrap =
  <T, R>(fn: (value: T) => R) =>
  (result: Result<T>): Result<R> =>
    result.ok ? { ok: true, data: fn(result.data) } : result;

// Matches the given `result` object against its `ok` property and invokes the `onSuccess` function
// if `ok` is `true`, or the `onError` function if `ok` is `false`. Returns the result of the invoked function.
//
// TSuccess - Type of the success value.
// TError - Type of the error value.
// TReturn - Type of the return value.
//
// result - The `Result` object to match against.
// onSuccess - The function to invoke if `result.ok` is `true`.
// onError - The function to invoke if `result.ok` is `false`.
//
// Returns the result of the invoked function.
//
// Example:
// const test = (): Result<string, Error> => {
//  return err(new Error("error happened"));
// }
//
// const result = test();
//
// match(result, (value) => {
//  console.log(value); // never run with this example
// }, (error) => {
//  console.log(error); // Error: error happened
// });
export const match = <TSuccess, TError, TReturn>(
  result: Result<TSuccess, TError>,
  onSuccess: (value: TSuccess) => TReturn,
  onError: (error: TError) => TReturn
): TReturn => (result.ok ? onSuccess(result.data) : onError(result.error));

// Wraps a function `fn` that may throw an error into a new function that returns a `Result` object.
// If the wrapped function throws an error, the returned `Result` object will have an `ok` property of `false`
// and an `error` property containing the thrown error. Otherwise, the returned `Result` object will have an
// `ok` property of `true` and a `data` property containing the result of the wrapped function.
//
// T - The type of the result value.
// A - An array of the types of the arguments expected by the wrapped function.
//
// fn - The function to wrap.
// Returns a new function that returns a `Result` object.
//
// Example:
// function divideByTwo(num: number): number {
//   if (num === 0) {
//     throw new Error("Cannot divide zero");
//   }
//   return num / 2;
// }
//
// const wrappedDivideByTwo = wrapThrows(divideByTwo);
//
// const result1: Result<number> = wrappedDivideByTwo(10); // { ok: true, data: 5 }
// const result2: Result<number> = wrappedDivideByTwo(0); // { ok: false, error: Error("Cannot divide zero") }
export const wrapThrows =
  <T, A extends unknown[]>(fn: (...args: A) => T): ((...args: A) => Result<T>) =>
  (...args: A): Result<T> => {
    try {
      return {
        ok: true,
        data: fn(...args),
      };
    } catch (error) {
      return {
        ok: false,
        error: error as Error,
      };
    }
  };

// Wraps an asynchronous function `fn` that may throw an error into a new function that returns a `Result` object.
// If the wrapped function throws an error, the returned `Result` object will have an `ok` property of `false`
// and an `error` property containing the thrown error. Otherwise, the returned `Result` object will have an
// `ok` property of `true` and a `data` property containing the result of the wrapped function.
//
// T - The type of the result value.
// A - An array of the types of the arguments expected by the wrapped function.
//
// fn - The asynchronous function to wrap.
// Returns a new function that returns a `Result` object.
//
// Example:
// async function fetchData(url: string): Promise<string> {
//   const response = await fetch(url);
//   if (!response.ok) {
//     throw new Error("Network response was not ok");
//   }
//   return response.text();
// }
//
// const wrappedFetchData = wrapThrowsAsync(fetchData);
//
// const result1: Result<string> = await wrappedFetchData("https://example.com"); // { ok: true, data: "..." }
// const result2: Result<string> = await wrappedFetchData("https://bad-url.com"); // { ok: false, error: Error("Network response was not ok") }
export const wrapThrowsAsync =
  <T, A extends unknown[]>(fn: (...args: A) => Promise<T>) =>
  async (...args: A): Promise<Result<T>> => {
    try {
      return {
        ok: true,
        data: await fn(...args),
      };
    } catch (error) {
      return {
        ok: false,
        error: error as Error,
      };
    }
  };
