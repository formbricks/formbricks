import { FORBIDDEN_IDS } from "@formbricks/types/surveys/validation";

const ELEMENT_ID_PATTERN = /^[A-Za-z0-9_-]+$/;
const MAX_ELEMENT_ID_LENGTH = 64;

/**
 * Names an id must never take, lowercased: every member of `Object.prototype` (`constructor`,
 * `__proto__`, `toString`, …) and `prototype`. The element id charset admits them and `FORBIDDEN_IDS`
 * does not list them, but an id becomes a key in maps all over the app — recall lookups, response data,
 * logic evaluation — and a plain-object lookup by one of these finds a function.
 */
export const OBJECT_MEMBER_NAMES: ReadonlySet<string> = new Set(
  [...Object.getOwnPropertyNames(Object.prototype), "prototype"].map((name) => name.toLowerCase())
);

/** Whether a name collides with an `Object.prototype` member, in any casing. */
export const isObjectMemberName = (name: string): boolean => OBJECT_MEMBER_NAMES.has(name.toLowerCase());

/**
 * The first of `stem<separator>2`, `stem<separator>3`, … that `isFree` accepts, the stem cut for each
 * candidate so that the candidate fits `maxLength` however wide the counter grows. Gives up with `null`
 * after `maxAttempts` candidates instead of looping: the caller's fallback decides what happens then.
 *
 * The candidates are pairwise distinct — the digits after the last separator are the counter, as long
 * as the separator holds no digit — so when `isFree` refuses a well-formed candidate only for being
 * taken, `maxAttempts` = the number of names taken + 1 always finds one.
 */
export function findFreeSuffixedName(
  stem: string,
  options: {
    separator: string;
    maxLength: number;
    maxAttempts: number;
    isFree: (candidate: string) => boolean;
  }
): string | null {
  const { separator, maxLength, maxAttempts, isFree } = options;
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const suffix = `${separator}${attempt + 2}`;
    const candidate = `${stem.slice(0, Math.max(0, maxLength - suffix.length))}${suffix}`;
    if (isFree(candidate)) return candidate;
  }
  return null;
}

/** `value` without the underscores it starts or ends with. A scan, not a regex: linear on any input. */
const trimUnderscores = (value: string): string => {
  let start = 0;
  let end = value.length;
  while (start < end && value[start] === "_") start += 1;
  while (end > start && value[end - 1] === "_") end -= 1;
  return value.slice(start, end);
};

/**
 * Hands out element ids. Ids must be unique case-insensitively across elements, hidden fields, endings
 * and variables (v3 reference validation), so the registry is seeded with the hidden field ids before
 * any element claims one, and with the reserved ids in every casing.
 *
 * An element gets its Qualtrics export tag (`Q12`) when it is clean and free, and its `QID` otherwise,
 * suffixed `_2`, `_3`, … when that is taken too.
 */
export class QsfIdRegistry {
  private readonly taken = new Set<string>();

  constructor(reserved: readonly string[] = []) {
    for (const id of [...FORBIDDEN_IDS, ...reserved]) this.taken.add(id.toLowerCase());
  }

  has(id: string): boolean {
    return this.taken.has(id.toLowerCase());
  }

  /** Claim `preferred` when usable, else `fallback`, suffixed `_2`, `_3`, … until free. */
  claim(preferred: string, fallback: string): string {
    const cleaned = trimUnderscores(
      preferred
        .slice(0, MAX_ELEMENT_ID_LENGTH * 2)
        .trim()
        .replaceAll(/[^A-Za-z0-9_-]+/g, "_")
    ).slice(0, MAX_ELEMENT_ID_LENGTH);
    if (this.isUsable(cleaned)) return this.take(cleaned);

    const base = this.isWellFormed(fallback) ? fallback : "question";
    if (this.isUsable(base)) return this.take(base);
    // Bounded by the names taken, so it always finds one: see `findFreeSuffixedName`. The suffixed
    // candidates are well-formed (the charset, the length, and no `Object.prototype` member ends in
    // `_<digits>`), so only being taken can refuse one.
    const suffixed = findFreeSuffixedName(base, {
      separator: "_",
      maxLength: MAX_ELEMENT_ID_LENGTH,
      maxAttempts: this.taken.size + 1,
      isFree: (candidate) => this.isUsable(candidate),
    });
    if (suffixed === null) throw new Error("QsfIdRegistry found no free element id");
    return this.take(suffixed);
  }

  private take(id: string): string {
    this.taken.add(id.toLowerCase());
    return id;
  }

  private isWellFormed(id: string): boolean {
    return (
      id.length > 0 &&
      id.length <= MAX_ELEMENT_ID_LENGTH &&
      ELEMENT_ID_PATTERN.test(id) &&
      !isObjectMemberName(id)
    );
  }

  private isUsable(id: string): boolean {
    return this.isWellFormed(id) && !this.has(id);
  }
}
