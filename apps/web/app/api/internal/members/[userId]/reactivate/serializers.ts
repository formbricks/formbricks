/** A reactivated member, or one who already was active, as the API returns them. */
export type TReactivatedMember = { userId: string; isActive: true };

export const serializeReactivatedMember = (userId: string): TReactivatedMember => ({
  userId,
  isActive: true,
});
