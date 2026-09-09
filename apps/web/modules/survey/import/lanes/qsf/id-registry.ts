import { FORBIDDEN_IDS } from "@formbricks/types/surveys/validation";

const ID_PATTERN = /^[a-zA-Z0-9_-]+$/;

/**
 * Element ids are user-editable and must be unique case-insensitively across elements, hidden
 * fields, endings and variable names (v3 reference validation). The registry hands out the export
 * tag when it is clean and free, and falls back to the `QID` otherwise.
 */
export class QsfIdRegistry {
  private readonly taken = new Set<string>();

  constructor(reserved: readonly string[] = []) {
    reserved.forEach((id) => this.taken.add(id.toLowerCase()));
  }

  has(id: string): boolean {
    return this.taken.has(id.toLowerCase());
  }

  /** Claim `preferred` when usable, else `fallback` (suffixed with `_2`, `_3`, … until free). */
  claim(preferred: string, fallback: string): string {
    const sanitizedPreferred = preferred
      .trim()
      .replaceAll(/[^a-zA-Z0-9_-]+/g, "_")
      .replaceAll(/^_+|_+$/g, "");
    if (this.isUsable(sanitizedPreferred)) {
      this.taken.add(sanitizedPreferred.toLowerCase());
      return sanitizedPreferred;
    }

    let candidate = fallback;
    let counter = 2;
    while (!this.isUsable(candidate)) {
      candidate = `${fallback}_${counter}`;
      counter += 1;
    }
    this.taken.add(candidate.toLowerCase());
    return candidate;
  }

  private isUsable(id: string): boolean {
    return id.length > 0 && ID_PATTERN.test(id) && !FORBIDDEN_IDS.includes(id) && !this.has(id);
  }
}
