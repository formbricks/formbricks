const ONBOARDING_PATHNAME_PATTERN = /^\/organizations\/[^/]+\/(workspaces\/new|landing)(\/|$)/;

export const isOnboardingPathname = (pathname: string): boolean => ONBOARDING_PATHNAME_PATTERN.test(pathname);
