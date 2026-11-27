import type {
  TMemberAttributeKey,
  TMemberAttributeKeyWithUsage,
  TMemberAttributeRowsCursor,
} from "@/modules/ee/member-attributes/lib/service";

/** `MemberAttributeKeyResource` in the spec. */
export const serializeMemberAttributeKey = (key: TMemberAttributeKey) => ({
  id: key.id,
  key: key.key,
  label: key.label,
  description: key.description,
  createdAt: key.createdAt.toISOString(),
  updatedAt: key.updatedAt.toISOString(),
});

/** `MemberAttributeKeyListItem`: the resource plus how widely it is used. */
export const serializeMemberAttributeKeyListItem = (key: TMemberAttributeKeyWithUsage) => ({
  ...serializeMemberAttributeKey(key),
  memberCount: key.memberCount,
  distinctValueCount: key.distinctValueCount,
});

export type TV3MemberAttributeKeyResource = ReturnType<typeof serializeMemberAttributeKey>;
export type TV3MemberAttributeKeyListItem = ReturnType<typeof serializeMemberAttributeKeyListItem>;

/** The list cursor is opaque to clients: base64url JSON of the phase and the last id. */
export const encodeMemberAttributeRowsCursor = (cursor: TMemberAttributeRowsCursor): string =>
  Buffer.from(JSON.stringify([cursor.phase === "member" ? "m" : "i", cursor.id]), "utf8").toString(
    "base64url"
  );

export const decodeMemberAttributeRowsCursor = (value: string): TMemberAttributeRowsCursor | null => {
  try {
    const decoded: unknown = JSON.parse(Buffer.from(value, "base64url").toString("utf8"));
    if (!Array.isArray(decoded) || decoded.length !== 2) return null;
    const [phase, id] = decoded as unknown[];
    if ((phase !== "m" && phase !== "i") || typeof id !== "string" || id.length > 64) return null;
    return { phase: phase === "m" ? "member" : "invite", id };
  } catch {
    return null;
  }
};
