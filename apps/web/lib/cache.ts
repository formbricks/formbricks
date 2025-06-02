// cache wrapper for unstable_cache
// workaround for https://github.com/vercel/next.js/issues/51613
// copied from https://github.com/vercel/next.js/issues/51613#issuecomment-1892644565
import { unstable_cache } from "next/cache";

export { revalidateTag } from "next/cache";

export const cache = <T, P extends unknown[]>(
  fn: (...params: P) => Promise<T>,
  _keys: Parameters<typeof unstable_cache>[1],
  _opts: Parameters<typeof unstable_cache>[2]
) => {
  // BYPASS NEXT.JS CACHE FOR TESTING - TEMPORARY CHANGE
  // Simply return the original function without any caching
  return fn;

  // COMMENTED OUT: Original Next.js cache implementation
  // Uncomment below to restore Next.js caching
  /*
  const wrap = async (params: unknown[]): Promise<string> => {
    const result = await fn(...(params as P));
    return stringify(result);
  };

  const cachedFn = unstable_cache(wrap, keys, opts);

  return async (...params: P): Promise<T> => {
    const result = await cachedFn(params);
    return parse(result);
  };
  */
};
