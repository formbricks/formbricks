import type { TEmailMatch, TMemberAttributeWrite } from "./service";
import { type TMemberAttributeValuesProblem, prepareMemberAttributeValues } from "./values";

/** One row of a bulk values request: who (by email) and the values per attribute `key`. */
export type TBulkMemberAttributeRow = {
  email: string;
  attributes: Record<string, string[]>;
};

export type TBulkRowProblem = {
  /** Where in the row: `email`, or `attributes.<key>`. */
  name: string;
  reason: string;
  code: "invalid_reference" | "limit_exceeded" | "duplicate_identifier" | "unsupported_field";
};

export type TBulkRowOutcome =
  | { index: number; email: string; status: "updated_member"; userId: string }
  | { index: number; email: string; status: "updated_invite"; inviteIds: string[] }
  | { index: number; email: string; status: "unknown_email" }
  | { index: number; email: string; status: "invalid"; problems: TBulkRowProblem[] };

const describeValuesProblem = (key: string, problem: TMemberAttributeValuesProblem): TBulkRowProblem => {
  const name = `attributes.${key}`;
  switch (problem.code) {
    case "too_many_values":
      return { name, code: "limit_exceeded", reason: `at most ${problem.limit} values per attribute` };
    case "value_too_long":
      return { name, code: "limit_exceeded", reason: `a value may have at most ${problem.limit} characters` };
    case "invalid_character":
      return { name, code: "unsupported_field", reason: "a value may not contain a NUL character" };
  }
};

/**
 * Decides what a bulk values request does, row by row, without touching the database: which member or
 * invites each email names, which keys and values it sets, and why a row is refused. A refused row
 * changes nothing; the others still apply.
 *
 * - The email is matched ignoring case and surrounding spaces; a second row for the same email is
 *   refused, so a batch cannot set one member twice in an order the caller did not mean.
 * - An unknown attribute `key` refuses the whole row (naming the key), so a typo never half-applies.
 * - Values are prepared per key (`prepareMemberAttributeValues`): trimmed, deduplicated, capped.
 */
export const planBulkMemberAttributeRows = ({
  rows,
  keyIdByKey,
  matches,
}: {
  rows: readonly TBulkMemberAttributeRow[];
  keyIdByKey: ReadonlyMap<string, string>;
  matches: ReadonlyMap<string, TEmailMatch>;
}): { outcomes: TBulkRowOutcome[]; writes: TMemberAttributeWrite[] } => {
  const outcomes: TBulkRowOutcome[] = [];
  const writes: TMemberAttributeWrite[] = [];
  const seenEmails = new Set<string>();

  rows.forEach((row, index) => {
    const email = row.email.trim().toLowerCase();
    const problems: TBulkRowProblem[] = [];

    if (seenEmails.has(email)) {
      problems.push({
        name: "email",
        code: "duplicate_identifier",
        reason: "an earlier row already sets this email",
      });
    }
    seenEmails.add(email);

    const valuesByKeyId = new Map<string, string[]>();
    for (const [key, values] of Object.entries(row.attributes)) {
      const keyId = keyIdByKey.get(key);
      if (!keyId) {
        problems.push({
          name: `attributes.${key}`,
          code: "invalid_reference",
          reason: "unknown attribute key",
        });
        continue;
      }
      const prepared = prepareMemberAttributeValues(values);
      if (!prepared.ok) {
        problems.push(describeValuesProblem(key, prepared.problem));
        continue;
      }
      valuesByKeyId.set(keyId, prepared.values);
    }

    if (problems.length > 0) {
      outcomes.push({ index, email, status: "invalid", problems });
      return;
    }

    const match = matches.get(email);
    if (!match) {
      outcomes.push({ index, email, status: "unknown_email" });
      return;
    }

    if (match.target === "member") {
      writes.push({ target: "member", userId: match.userId, valuesByKeyId });
      outcomes.push({ index, email, status: "updated_member", userId: match.userId });
    } else {
      for (const inviteId of match.inviteIds) {
        writes.push({ target: "invite", inviteId, valuesByKeyId });
      }
      outcomes.push({ index, email, status: "updated_invite", inviteIds: match.inviteIds });
    }
  });

  return { outcomes, writes };
};
