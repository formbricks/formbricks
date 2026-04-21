import "server-only";
import type { TInvitationAudience } from "@formbricks/types/surveys/types";
import { executeConfiguredQuery } from "@/app/api/member-lookup/configurable-query-service";
import { getContactsInSegment } from "@/modules/ee/contacts/lib/contacts";

export type TAudienceMember = {
  email: string;
  // Full name for the `{{recipientName}}` merge field. Derived from first+last
  // when both are available, or null if neither is known.
  name: string | null;
  firstName: string | null;
  lastName: string | null;
  // If the audience comes from a Formbricks segment, we already have a Contact row.
  // Snowflake-sourced members get a Contact row created lazily at invitation-send time.
  existingContactId: string | null;
};

// Resolves a survey's configured audience into a flat list of recipient candidates.
// Email-less rows are filtered out — we can't invite someone without an address.
// Duplicates by email are collapsed to the first occurrence.
export async function resolveAudience(audience: TInvitationAudience): Promise<TAudienceMember[]> {
  if (audience.source === "segment") {
    return resolveSegmentAudience(audience.segmentId);
  }
  if (audience.source === "manualList") {
    return resolveManualListAudience(audience.recipients);
  }
  return resolveSnowflakeAudience(audience);
}

function resolveManualListAudience(
  recipients: { email: string; firstName?: string; lastName?: string }[]
): TAudienceMember[] {
  const seen = new Set<string>();
  const out: TAudienceMember[] = [];
  for (const r of recipients) {
    const email = r.email.trim().toLowerCase();
    if (!email || seen.has(email)) continue;
    seen.add(email);
    const firstName = r.firstName?.trim() || null;
    const lastName = r.lastName?.trim() || null;
    const name = [firstName, lastName].filter(Boolean).join(" ") || null;
    out.push({ email, name, firstName, lastName, existingContactId: null });
  }
  return out;
}

async function resolveSegmentAudience(segmentId: string): Promise<TAudienceMember[]> {
  const contacts = await getContactsInSegment(segmentId);
  if (!contacts) return [];

  const seen = new Set<string>();
  const out: TAudienceMember[] = [];
  for (const contact of contacts) {
    const email = (contact.attributes?.email ?? "").trim().toLowerCase();
    if (!email || seen.has(email)) continue;
    seen.add(email);
    const firstName = contact.attributes?.firstName?.trim() || null;
    const lastName = contact.attributes?.lastName?.trim() || null;
    const name = [firstName, lastName].filter(Boolean).join(" ") || null;
    out.push({
      email,
      name,
      firstName,
      lastName,
      existingContactId: contact.contactId,
    });
  }
  return out;
}

async function resolveSnowflakeAudience(
  audience: Extract<TInvitationAudience, { source: "snowflake" }>
): Promise<TAudienceMember[]> {
  // executeConfiguredQuery returns either a single row object or null.
  // For audience queries we expect the query-config to return an array-shaped
  // payload (row list). If the config returns a scalar we wrap it.
  const result = await executeConfiguredQuery(audience.queryId, {});
  if (!result) return [];

  const rows: Record<string, unknown>[] = Array.isArray(result) ? result : [result];

  const seen = new Set<string>();
  const out: TAudienceMember[] = [];
  for (const row of rows) {
    const raw = row[audience.emailColumn];
    if (typeof raw !== "string") continue;
    const email = raw.trim().toLowerCase();
    if (!email || seen.has(email)) continue;
    seen.add(email);

    const nameRaw = audience.nameColumn ? row[audience.nameColumn] : null;
    const name = typeof nameRaw === "string" && nameRaw.trim() ? nameRaw.trim() : null;
    // For Snowflake sources we only have a single nameColumn; split on first
    // whitespace for a best-effort first/last so merge fields can still work.
    let firstName: string | null = null;
    let lastName: string | null = null;
    if (name) {
      const [first, ...rest] = name.split(/\s+/);
      firstName = first || null;
      lastName = rest.join(" ") || null;
    }

    out.push({ email, name, firstName, lastName, existingContactId: null });
  }
  return out;
}
