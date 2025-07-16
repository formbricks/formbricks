export const getCallbackUrl = (inviteUrl?: string, source?: string) => {
  return inviteUrl
    ? `${inviteUrl}${inviteUrl.includes("?") ? "&" : "?"}source=${source}`
    : `/?source=${source}`;
};
