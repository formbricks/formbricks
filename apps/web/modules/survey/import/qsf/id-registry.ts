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
 * Hands out element ids. Ids must be unique case-insensitively across elements, hidden fields, endings
 * and variables (v3 reference validation), so the registry is seeded with the hidden field ids before
 * any element claims one, and with the reserved ids in every casing.
 *
 * An element gets its Qualtrics export tag (`Q12`) when it is clean and free, and its `QID` otherwise.
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
    const cleaned = preferred
      .slice(0, MAX_ELEMENT_ID_LENGTH * 2)
      .trim()
      .replaceAll(/[^A-Za-z0-9_-]+/g, "_")
      .replaceAll(/^_+|_+$/g, "")
      .slice(0, MAX_ELEMENT_ID_LENGTH);
    if (this.isUsable(cleaned)) return this.take(cleaned);

    const base = this.isWellFormed(fallback) ? fallback : "question";
    let candidate = base;
    for (let counter = 2; !this.isUsable(candidate); counter += 1) {
      candidate = `${base}_${counter}`;
    }
    return this.take(candidate);
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
