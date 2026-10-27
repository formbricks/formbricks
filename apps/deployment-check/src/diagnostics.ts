/**
 * Every failure names the component that is broken and the next step, because the reader is an
 * operator looking at a deployment, not a developer looking at a stack trace.
 */
export class CheckFailure extends Error {
  constructor(component: string, problem: string, nextStep: string) {
    super(`${component}: ${problem}. Next step: ${nextStep}.`);
    this.name = "CheckFailure";
  }
}

const HEALTH_HINTS: Record<string, { component: string; nextStep: string }> = {
  main_database: {
    component: "Postgres",
    nextStep: "check DATABASE_URL and that the database accepts connections from the app",
  },
  cache_database: {
    component: "Redis",
    nextStep: "check REDIS_URL and that the cache is running and reachable from the app",
  },
};

/** Components `/api/v2/health` reports as down. An absent key counts as down: it cannot be verified. */
export const failingHealthComponents = (data: unknown): string[] => {
  const record = typeof data === "object" && data !== null ? (data as Record<string, unknown>) : {};
  return Object.keys(HEALTH_HINTS).filter((key) => record[key] !== true);
};

export const describeHealthFailures = (failing: readonly string[]): string =>
  failing
    .map((key) => {
      const hint = HEALTH_HINTS[key];
      return `${hint.component} unreachable — ${hint.nextStep}`;
    })
    .join("; ");

export const authFailure = (status: number, workspaceId: string): CheckFailure => {
  if (status === 401) {
    return new CheckFailure(
      "API key",
      "API key invalid (HTTP 401)",
      "create a new organization API key and pass it as FORMBRICKS_API_KEY"
    );
  }
  if (status === 403) {
    return new CheckFailure(
      "API key",
      `key lacks access to workspace ${workspaceId} (HTTP 403)`,
      "give the key write access to the deployment-check workspace"
    );
  }
  return new CheckFailure(
    "Management API",
    `unexpected HTTP ${status}`,
    "check the app logs for the request; the app may be failing behind the proxy"
  );
};
