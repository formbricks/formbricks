import type { TFilterOption, TFilterOptionsPage } from "./types";

/** A loader's answer as one shape, whether it returned a plain list or the first page of a longer one. */
export const toFilterOptionsPage = (loaded: TFilterOption[] | TFilterOptionsPage): TFilterOptionsPage =>
  Array.isArray(loaded) ? { options: loaded, hasMore: false } : loaded;
