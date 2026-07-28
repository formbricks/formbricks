import "server-only";

const ORGANIZATION_ID = "application-relationship-smoke";
const USER_ID = "application-relationship-smoke";
const ORGANIZATION_RELATIONS = ["billing", "manager", "member", "owner"] as const;

type TSmokeCommand = "delete" | "set-billing" | "set-owner";

const writeResult = (result: object): void => {
  process.stdout.write(`${JSON.stringify(result)}\n`);
};

const isSmokeCommand = (value: string | undefined): value is TSmokeCommand =>
  value === "delete" || value === "set-billing" || value === "set-owner";

const run = async (): Promise<void> => {
  const startedAt = performance.now();
  const latencyMs = (): number => Math.max(0, Math.round(performance.now() - startedAt));

  if (process.env.NODE_ENV !== "test") {
    writeResult({
      code: "authzed_smoke_refused",
      latencyMs: latencyMs(),
      retryable: false,
      status: "failed",
    });
    process.exitCode = 1;
    return;
  }

  const command = process.argv[2];
  if (!isSmokeCommand(command)) {
    writeResult({
      code: "authzed_invalid_request",
      latencyMs: latencyMs(),
      retryable: false,
      status: "failed",
    });
    process.exitCode = 1;
    return;
  }

  let closeClient: (() => void) | undefined;

  try {
    const { closeAuthzedClient, getAuthzedClient } = await import("../lib/authzed/client");
    closeClient = closeAuthzedClient;

    const selectedRelation =
      command === "set-owner" ? "owner" : command === "set-billing" ? "billing" : undefined;

    await getAuthzedClient().writeRelationships(
      ORGANIZATION_RELATIONS.map((relation) => ({
        operation: selectedRelation === relation ? "touch" : "delete",
        relationship: {
          relation,
          resource: {
            objectId: ORGANIZATION_ID,
            objectType: "organization",
          },
          subject: {
            objectId: USER_ID,
            objectType: "user",
          },
        },
      }))
    );

    writeResult({ latencyMs: latencyMs(), status: "projected" });
    process.exitCode = 0;
  } catch (error) {
    const { AuthzedError } = await import("../lib/authzed/errors");

    if (error instanceof AuthzedError) {
      writeResult({
        attempts: error.attempts,
        code: error.code,
        latencyMs: latencyMs(),
        retryable: error.retryable,
        status: "failed",
      });
    } else {
      writeResult({
        code: "authzed_internal",
        latencyMs: latencyMs(),
        retryable: false,
        status: "failed",
      });
    }
    process.exitCode = 1;
  } finally {
    closeClient?.();
  }
};

void run();
