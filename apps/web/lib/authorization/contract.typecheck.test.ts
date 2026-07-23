import "server-only";
import { describe, expect, test } from "vitest";
import type {
  TAuthorizationAction,
  TAuthorizationActor,
  TAuthorizationResource,
  TAuthorizationResourceForAction,
} from "./contract";

type TEqual<TLeft, TRight> =
  (<T>() => T extends TLeft ? 1 : 2) extends <T>() => T extends TRight ? 1 : 2
    ? (<T>() => T extends TRight ? 1 : 2) extends <T>() => T extends TLeft ? 1 : 2
      ? true
      : false
    : false;

type TExpect<TValue extends true> = TValue;

type TExpectedAuthorizationAction =
  | "apiKey.read"
  | "apiKey.manage"
  | "organization.read"
  | "organization.write"
  | "organization.manage"
  | "organization.manage_billing"
  | "organization.read_access"
  | "organization.manage_access"
  | "organization.manage_api_keys"
  | "team.read"
  | "team.manage"
  | "team.delete"
  | "workspace.read"
  | "workspace.write"
  | "workspace.manage"
  | "workspace.share"
  | "survey.read"
  | "survey.write"
  | "survey.manage"
  | "survey.delete"
  | "survey.publish"
  | "survey.response_read"
  | "survey.response_export"
  | "dashboard.read"
  | "dashboard.write"
  | "response.read"
  | "response.write"
  | "response.manage"
  | "response.export";

type TActionVocabularyIsExact = TExpect<TEqual<TAuthorizationAction, TExpectedAuthorizationAction>>;

type TExpectedResourceForAction<TAction extends TExpectedAuthorizationAction> =
  TAction extends `${infer TResourceType}.${string}`
    ? Readonly<{
        type: TResourceType;
        id: string;
      }>
    : never;

type TAllActionResourceMappingsAreExact = TExpect<
  {
    [TAction in TExpectedAuthorizationAction]: TEqual<
      TAuthorizationResourceForAction<TAction>,
      TExpectedResourceForAction<TAction>
    >;
  }[TExpectedAuthorizationAction] extends true
    ? true
    : false
>;

const actionVocabularyIsExact: TActionVocabularyIsExact = true;
const allActionResourceMappingsAreExact: TAllActionResourceMappingsAreExact = true;

const checkAuthorizationTypes = <TAction extends TAuthorizationAction>(
  _actor: TAuthorizationActor,
  _action: TAction,
  _resource: TAuthorizationResourceForAction<NoInfer<TAction>>
): void => undefined;

describe("current authorization contract types", () => {
  test("keeps the action vocabulary and resource mappings exact", () => {
    expect(actionVocabularyIsExact).toBe(true);
    expect(allActionResourceMappingsAreExact).toBe(true);
  });

  test("accepts current actors and matching action/resource pairs", () => {
    expect(
      checkAuthorizationTypes({ type: "user", id: "user-id" }, "survey.read", {
        type: "survey",
        id: "survey-id",
      })
    ).toBeUndefined();
    expect(
      checkAuthorizationTypes({ type: "apiKey", id: "api-key-id" }, "workspace.write", {
        type: "workspace",
        id: "workspace-id",
      })
    ).toBeUndefined();
  });

  test("rejects unsupported actors, actions, and resource combinations", () => {
    const actor: TAuthorizationActor = { type: "user", id: "user-id" };
    const resource: TAuthorizationResource = { type: "survey", id: "survey-id" };
    const systemActor: TAuthorizationActor = {
      // @ts-expect-error System principals are not part of the current contract.
      type: "system",
      id: "system-id",
    };

    const systemActorResult = checkAuthorizationTypes(systemActor, "survey.read", resource);

    // @ts-expect-error Survey-level sharing is a deferred capability.
    const surveyShareResult = checkAuthorizationTypes(actor, "survey.share", resource);

    const dashboardManageResult = checkAuthorizationTypes(
      actor,
      // @ts-expect-error Per-dashboard management is a deferred capability.
      "dashboard.manage",
      {
        type: "dashboard",
        id: "dashboard-id",
      }
    );

    const auditLogReadResult = checkAuthorizationTypes(
      actor,
      // @ts-expect-error Audit-log access is not part of the current contract.
      "auditLog.read",
      {
        type: "organization",
        id: "organization-id",
      }
    );

    const mismatchedResourceResult = checkAuthorizationTypes(actor, "survey.read", {
      // @ts-expect-error A survey action cannot target a workspace.
      type: "workspace",
      id: "workspace-id",
    });

    expect(systemActorResult).toBeUndefined();
    expect(surveyShareResult).toBeUndefined();
    expect(dashboardManageResult).toBeUndefined();
    expect(auditLogReadResult).toBeUndefined();
    expect(mismatchedResourceResult).toBeUndefined();
  });

  test("requires immutable actors and resources with opaque identifiers", () => {
    // @ts-expect-error Actors require an opaque identifier.
    const actorWithoutId: TAuthorizationActor = { type: "user" };

    // @ts-expect-error Resources require an opaque identifier.
    const resourceWithoutId: TAuthorizationResource = { type: "response" };

    const actor: TAuthorizationActor = { type: "user", id: "user-id" };
    const resource: TAuthorizationResource = { type: "response", id: "response-id" };

    // @ts-expect-error Authorization actors are immutable.
    actor.id = "other-user-id";

    // @ts-expect-error Authorization resources are immutable.
    resource.id = "other-response-id";

    expect(actorWithoutId).toEqual({ type: "user" });
    expect(resourceWithoutId).toEqual({ type: "response" });
    expect(actor.id).toBe("other-user-id");
    expect(resource.id).toBe("other-response-id");
  });
});
