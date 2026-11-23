/**
 * Typed outcomes of the Member attribute service, raised at its input boundary so the v3 operations map
 * each to its status by type rather than by message (CODING_STANDARDS "Errors").
 */

/** The key id names no key of this organization. Answered 403 so ids cannot be probed. */
export class MemberAttributeKeyNotFoundError extends Error {
  constructor() {
    super("Member attribute key not found");
    this.name = "MemberAttributeKeyNotFoundError";
  }
}

/** Another key of the organization already uses this `key`. */
export class MemberAttributeKeyTakenError extends Error {
  constructor(readonly key: string) {
    super("A Member attribute with this key already exists");
    this.name = "MemberAttributeKeyTakenError";
  }
}

/** The organization already has `MEMBER_ATTRIBUTE_MAX_KEYS_PER_ORGANIZATION` keys. */
export class MemberAttributeKeyLimitError extends Error {
  constructor(readonly limit: number) {
    super(`An organization can have at most ${limit} Member attributes`);
    this.name = "MemberAttributeKeyLimitError";
  }
}

/** The key changed since the `expectedUpdatedAt` the caller sent. */
export class MemberAttributeKeyConflictError extends Error {
  constructor(readonly currentUpdatedAt: Date) {
    super("The Member attribute changed since it was read");
    this.name = "MemberAttributeKeyConflictError";
  }
}

/** Dashboard Viewer access of these Feedback Datasets matches on the key, so it cannot be deleted. */
export class MemberAttributeKeyInUseError extends Error {
  constructor(
    readonly datasets: { id: string; name: string }[],
    readonly datasetCount: number
  ) {
    super("Dashboard Viewer access uses this Member attribute");
    this.name = "MemberAttributeKeyInUseError";
  }
}
