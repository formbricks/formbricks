export const getSsoReturnToUrl = (returnToUrl?: string, source?: string) => {
  const fallbackBaseUrl = "http://localhost";
  const nextReturnToUrl = new URL(returnToUrl ?? "/", fallbackBaseUrl);

  if (source) {
    nextReturnToUrl.searchParams.set("source", source);
  }

  if (!returnToUrl || returnToUrl.startsWith("/")) {
    return `${nextReturnToUrl.pathname}${nextReturnToUrl.search}${nextReturnToUrl.hash}`;
  }

  return nextReturnToUrl.toString();
};
