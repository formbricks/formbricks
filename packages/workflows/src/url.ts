/**
 * `url` without trailing slashes. A loop rather than `url.replace(/\/+$/, "")`: that regex retries at
 * every `/` of a long run, so it is quadratic on input like `"a////…/b"`.
 */
export const withoutTrailingSlashes = (url: string): string => {
  let end = url.length;
  while (end > 0 && url[end - 1] === "/") end--;
  return url.slice(0, end);
};
