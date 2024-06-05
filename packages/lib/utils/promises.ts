export const delay = (ms: number) => {
  return new Promise((resolve) => setTimeout(resolve, ms));
};

export function isFulfilled<T>(val: PromiseSettledResult<T>): val is PromiseFulfilledResult<T> {
  return val.status === "fulfilled";
}

export function isRejected<T>(val: PromiseSettledResult<T>): val is PromiseRejectedResult {
  return val.status === "rejected";
}
