import "server-only";
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

const assertAuthorizationContractTypes = (): void => {
  const actor: TAuthorizationActor = { type: "user", id: "user-id" };
  const resource: TAuthorizationResource = { type: "survey", id: "survey-id" };

  checkAuthorizationTypes(actor, "survey.read", resource);
  checkAuthorizationTypes({ type: "apiKey", id: "api-key-id" }, "workspace.write", {
    type: "workspace",
    id: "workspace-id",
  });

  // @ts-expect-error System principals are not part of the current contract.
  checkAuthorizationTypes({ type: "system", id: "system-id" }, "survey.read", resource);

  // @ts-expect-error Survey-level sharing is a deferred capability.
  checkAuthorizationTypes(actor, "survey.share", resource);

  // @ts-expect-error Per-dashboard management is a deferred capability.
  checkAuthorizationTypes(actor, "dashboard.manage", { type: "dashboard", id: "dashboard-id" });

  // @ts-expect-error Audit-log access is not part of the current contract.
  checkAuthorizationTypes(actor, "auditLog.read", { type: "organization", id: "organization-id" });

  // @ts-expect-error A survey action cannot target a workspace.
  checkAuthorizationTypes(actor, "survey.read", { type: "workspace", id: "workspace-id" });

  // @ts-expect-error Actors require an opaque identifier.
  const actorWithoutId: TAuthorizationActor = { type: "user" };

  // @ts-expect-error Resources require an opaque identifier.
  const resourceWithoutId: TAuthorizationResource = { type: "response" };

  // @ts-expect-error Authorization actors are immutable.
  actor.id = "other-user-id";

  // @ts-expect-error Authorization resources are immutable.
  resource.id = "other-survey-id";

  void actorWithoutId;
  void resourceWithoutId;
};

void actionVocabularyIsExact;
void allActionResourceMappingsAreExact;
void assertAuthorizationContractTypes;
