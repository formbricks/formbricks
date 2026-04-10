export const getCallbackUrl = (inviteUrl?: string, source?: string) => {
  const fallbackBaseUrl = "http://localhost";
  const callbackUrl = new URL(inviteUrl ?? "/", fallbackBaseUrl);

  if (source) {
    callbackUrl.searchParams.set("source", source);
  }

  if (!inviteUrl || inviteUrl.startsWith("/")) {
    return `${callbackUrl.pathname}${callbackUrl.search}${callbackUrl.hash}`;
  }

  return callbackUrl.toString();
};
