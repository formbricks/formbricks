export const AUTH_METHOD_IDS = ["Email", "Google", "Github", "Azure", "OpenID", "Saml"] as const;

export type AuthMethodId = (typeof AUTH_METHOD_IDS)[number];

export const sortAuthMethodsByLastUsed = <T extends AuthMethodId>(
  methods: T[],
  lastLoggedInWith: string
): T[] => {
  if (!lastLoggedInWith) {
    return methods;
  }

  const lastUsed = lastLoggedInWith as AuthMethodId;

  if (!methods.includes(lastUsed as T)) {
    return methods;
  }

  return [lastUsed as T, ...methods.filter((method) => method !== lastUsed)];
};

export const getAuthMethodButtonVariant = (
  method: AuthMethodId,
  lastLoggedInWith: string
): "default" | "secondary" => {
  return method === lastLoggedInWith ? "default" : "secondary";
};
