import type { TMember, TOrganizationRole } from "@formbricks/types/memberships";
import { normalizeMemberAttributeValue } from "@/modules/ee/member-attributes/lib/values";
import type { TInvite } from "@/modules/organization/settings/teams/types/invites";

/**
 * The Members table's rows (ENG-7474): memberships and pending invites in one list, joined to their teams
 * and their Member attribute values (read through the v3 list, matched by email). Pure, so the joins and
 * the Member settings diff are unit-tested.
 */

export type TMemberTeam = {
  id: string;
  name: string;
  /** The member's team role; absent for an invite's teams. */
  role?: "admin" | "contributor";
  /** "Workspace A (read), Workspace B (manage)". */
  workspaceAccess: { name: string; permission: string }[];
};

export type TMemberTableRow = {
  id: string;
  kind: "member" | "invite";
  name: string;
  email: string;
  role: TOrganizationRole;
  status: "active" | "inactive" | "invited" | "expired";
  teams: TMemberTeam[];
  attributes: Record<string, string[]>;
  member?: TMember;
  invite?: TInvite;
};

export type TAttributeValuesRow = {
  type: "member" | "invite";
  email: string;
  attributes: Record<string, string[]>;
};

const byEmail = (rows: readonly TAttributeValuesRow[], type: TAttributeValuesRow["type"]) =>
  new Map(rows.filter((row) => row.type === type).map((row) => [row.email.toLowerCase(), row.attributes]));

export const buildMemberTableRows = ({
  members,
  invites,
  teamsByUserId,
  teamsByInviteId,
  attributeRows,
  now = new Date(),
}: {
  members: readonly TMember[];
  invites: readonly TInvite[];
  teamsByUserId: Readonly<Record<string, TMemberTeam[]>>;
  /** The teams an invite will add the person to (`Invite.teamIds`), resolved on the server. */
  teamsByInviteId: Readonly<Record<string, TMemberTeam[]>>;
  attributeRows: readonly TAttributeValuesRow[];
  now?: Date;
}): TMemberTableRow[] => {
  const memberValues = byEmail(attributeRows, "member");
  const inviteValues = byEmail(attributeRows, "invite");

  return [
    ...members.map(
      (member): TMemberTableRow => ({
        id: `member:${member.userId}`,
        kind: "member",
        name: member.name ?? "",
        email: member.email,
        role: member.role,
        status: member.isActive ? "active" : "inactive",
        teams: teamsByUserId[member.userId] ?? [],
        attributes: memberValues.get(member.email.toLowerCase()) ?? {},
        member,
      })
    ),
    ...invites.map(
      (invite): TMemberTableRow => ({
        id: `invite:${invite.id}`,
        kind: "invite",
        name: invite.name ?? "",
        email: invite.email,
        role: invite.role,
        status: new Date(invite.expiresAt) < now ? "expired" : "invited",
        teams: teamsByInviteId[invite.id] ?? [],
        attributes: inviteValues.get(invite.email.toLowerCase()) ?? {},
        invite,
      })
    ),
  ];
};

/** Whether a row matches the table search: name or email, ignoring case. */
export const matchesMemberSearch = (row: TMemberTableRow, search: string): boolean => {
  const needle = search.trim().toLowerCase();
  if (needle === "") return true;
  return row.name.toLowerCase().includes(needle) || row.email.toLowerCase().includes(needle);
};

/** The values others hold for `key`, distinct ignoring case, alphabetically: the field's suggestions. */
export const getAttributeSuggestions = (rows: readonly TMemberTableRow[], key: string): string[] => {
  const byNormalized = new Map<string, string>();
  for (const row of rows) {
    for (const value of row.attributes[key] ?? []) {
      const normalized = normalizeMemberAttributeValue(value);
      if (!byNormalized.has(normalized)) byNormalized.set(normalized, value);
    }
  }
  return [...byNormalized.values()].sort((a, b) => a.localeCompare(b));
};

const sameValues = (a: readonly string[], b: readonly string[]) =>
  a.length === b.length && a.every((value, index) => value === b[index]);

/**
 * The keys Member settings changed, with their new values: what Save sends to the bulk endpoint, so an
 * untouched key is never rewritten (and never races another editor's change to it).
 */
export const getChangedAttributes = (
  before: Readonly<Record<string, readonly string[]>>,
  after: Readonly<Record<string, readonly string[]>>
): Record<string, string[]> => {
  const changed: Record<string, string[]> = {};
  for (const [key, values] of Object.entries(after)) {
    if (!sameValues(before[key] ?? [], values)) changed[key] = [...values];
  }
  return changed;
};
