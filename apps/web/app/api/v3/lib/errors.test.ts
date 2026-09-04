import { describe, expect, test, vi } from "vitest";
import {
  AuthorizationError,
  DatabaseError,
  InvalidInputError,
  OperationNotAllowedError,
  ResourceNotFoundError,
  TooManyRequestsError,
  UniqueConstraintError,
  ValidationError,
} from "@formbricks/types/errors";
import { mapV3ThrownError } from "./errors";

vi.mock("server-only", () => ({}));

const requestId = "req_1";
const instance = "/api/v3/surveys";

const makeLog = () => ({ warn: vi.fn(), error: vi.fn() });
const ctx = (log = makeLog()) => ({ log, requestId, instance });

describe("mapV3ThrownError", () => {
  /**
   * The disclosure rule this module exists to hold in one place: a resource the caller cannot see must be
   * indistinguishable from one that does not exist, so a missing resource is a 403 and its id never
   * reaches the body.
   */
  test("maps a missing resource to 403, not 404, and keeps the id out of the body", async () => {
    const response = mapV3ThrownError(new ResourceNotFoundError("Survey", "survey_secret"), ctx());

    expect(response.status).toBe(403);
    const body = await response.json();
    expect(body.code).toBe("forbidden");
    expect(JSON.stringify(body)).not.toContain("survey_secret");
  });

  /**
   * The property the 403 mapping exists for, pinned directly: "it is not there" and "it is not yours"
   * must be one answer. Asserting `code` and the absent id is not enough — giving either branch its own
   * detail would keep both of those true and still hand back an oracle, which is exactly the mistake
   * a second surface relying on this default is liable to make.
   */
  test("renders one identical body whichever way the caller is refused", async () => {
    const missing = await mapV3ThrownError(new ResourceNotFoundError("Survey", "s1"), ctx()).json();
    const refused = await mapV3ThrownError(new AuthorizationError("not a member"), ctx()).json();

    delete missing.requestId;
    delete refused.requestId;
    expect(missing).toEqual(refused);
  });

  test.each([
    ["AuthorizationError", new AuthorizationError("user 42 lacks manage on ws_9")],
    ["OperationNotAllowedError", new OperationNotAllowedError("ai_features_not_enabled")],
  ])("maps %s to 403 without echoing its developer-facing message", async (_name, error) => {
    const response = mapV3ThrownError(error, ctx());

    expect(response.status).toBe(403);
    const body = await response.json();
    expect(body.detail).toBe("You are not authorized to access this resource");
    expect(JSON.stringify(body)).not.toContain(error.message);
  });

  test("maps an upstream rate limit to 429 and passes Retry-After through", async () => {
    const response = mapV3ThrownError(new TooManyRequestsError("quota", 30), ctx());

    expect(response.status).toBe(429);
    expect(response.headers.get("Retry-After")).toBe("30");
    expect((await response.json()).instance).toBe(instance);
  });

  /**
   * A 500 would invite a retry of a request that can never succeed — the same class of harm as
   * answering 502 for an upstream 503. The offending value is not echoed: a uniqueness message can
   * name a column, and a surface with something safe to say maps the error itself.
   */
  test("maps a uniqueness conflict to 409, without naming the constraint", async () => {
    const response = mapV3ThrownError(
      new UniqueConstraintError('Unique constraint failed on "Response_singleUseId_key"'),
      ctx()
    );

    expect(response.status).toBe(409);
    const body = await response.json();
    expect(body.code).toBe("conflict");
    expect(JSON.stringify(body)).not.toContain("singleUseId");
  });

  /**
   * `DatabaseError` wraps the raw Prisma message by codebase convention, which carries table, column and
   * constraint names — so this branch existing at all is the point.
   */
  test("maps a database failure to a generic 500 without leaking the query text", async () => {
    const error = new DatabaseError('column "hashed_key" of relation "ApiKey" does not exist');
    const response = mapV3ThrownError(error, ctx());

    expect(response.status).toBe(500);
    const body = await response.json();
    expect(body.detail).toBe("An unexpected error occurred.");
    expect(JSON.stringify(body)).not.toContain("hashed_key");
  });

  test("maps an unknown throw to a generic 500 without leaking the message", async () => {
    const response = mapV3ThrownError(new Error("connect ECONNREFUSED 10.0.0.4:5432"), ctx());

    expect(response.status).toBe(500);
    expect(JSON.stringify(await response.json())).not.toContain("10.0.0.4");
  });

  /**
   * Neither is safe to map centrally, so both must reach the generic 500 here rather than a 4xx: a
   * `ValidationError` can come from work `createSurvey` does after its transaction commits, where a 4xx
   * would wrongly say nothing was written (ENG-2587), and `InvalidInputError` is only the caller's fault
   * on the surfaces that know the input is theirs. Those surfaces map them above this call.
   */
  test.each([
    ["ValidationError", new ValidationError("buttonUrl must be https")],
    ["InvalidInputError", new InvalidInputError("cursor is malformed")],
  ])("leaves %s to the per-surface mappers rather than guessing a 4xx", (_name, error) => {
    expect(mapV3ThrownError(error, ctx()).status).toBe(500);
  });

  describe("logging", () => {
    test("logs a 4xx at warn and a 5xx at error, exactly once", () => {
      const clientLog = makeLog();
      mapV3ThrownError(new ResourceNotFoundError("Survey", "s1"), ctx(clientLog));
      expect(clientLog.warn).toHaveBeenCalledTimes(1);
      expect(clientLog.error).not.toHaveBeenCalled();

      const serverLog = makeLog();
      mapV3ThrownError(new DatabaseError("down"), ctx(serverLog));
      expect(serverLog.error).toHaveBeenCalledTimes(1);
      expect(serverLog.warn).not.toHaveBeenCalled();
    });

    /**
     * The key is the contract with pino: `@formbricks/logger` registers `stdSerializers.err` for `err`
     * and nothing else, so logging under `error` drops `message` and `stack` and leaves a 500 with only
     * the error's enumerable own properties. Asserted here because the loss is silent.
     */
    test("logs the thrown value under `err`, the only key the serializer covers", () => {
      const log = makeLog();
      const thrown = new DatabaseError('relation "Survey" does not exist');
      mapV3ThrownError(thrown, ctx(log));

      const fields = log.error.mock.calls[0][0];
      expect(fields.err).toBe(thrown);
      expect(fields).not.toHaveProperty("error");
    });

    // The label is what replaced six bespoke message strings, so it has to be queryable as a field.
    test("carries the operation label as a structured field", () => {
      const log = makeLog();
      mapV3ThrownError(new DatabaseError("down"), { ...ctx(log), operation: "surveys.archive" });

      expect(log.error).toHaveBeenCalledWith(
        expect.objectContaining({ operation: "surveys.archive", statusCode: 500 }),
        "V3 database error"
      );
    });

    test("omits the operation field entirely when the caller has no label", () => {
      const log = makeLog();
      mapV3ThrownError(new DatabaseError("down"), ctx(log));

      expect(log.error.mock.calls[0][0]).not.toHaveProperty("operation");
    });
  });
});
