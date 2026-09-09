import { notFound, redirect } from "next/navigation";
import { ResourceNotFoundError } from "@formbricks/types/errors";
import { can } from "@/lib/authorization";
import { withAuthorizationSurface } from "@/lib/authorization/context";
import { IS_FORMBRICKS_CLOUD } from "@/lib/constants";
import { getOrganization } from "@/lib/organization/service";
import { getTranslate } from "@/lingodotdev/server";
import { getSession } from "@/modules/auth/lib/session";
import { invalidateOrganizationBillingCache } from "@/modules/ee/billing/lib/organization-billing";

const OnboardingLayout = async (props: {
  params: Promise<{ organizationId: string }>;
  children: React.ReactNode;
}) => {
  const params = await props.params;

  const { children } = props;
  const t = await getTranslate();

  const session = await getSession();
  if (!session?.user) {
    return redirect(`/auth/login`);
  }

  // ENG-2388: was `getAccessFlags(membership?.role)` then `if (isMember || isBilling) return notFound()`.
  //
  // That is a denylist, and it named only the two roles to reject — so a user with NO membership in
  // this organization produced all-false flags and fell straight through it. `organization.manage`
  // (`owner + manager` in the schema) is the allowlist the check was reaching for: it admits exactly
  // the roles the denylist intended to leave, and denies the non-member the denylist missed.
  //
  // That non-member is defense-in-depth, not a new denial: the parent onboarding layout already
  // refuses them via `canUserAccessOrganization`, verified at runtime (it throws `AuthorizationError`
  // before this subtree completes). What the allowlist adds is that this layout no longer *depends*
  // on that parent — RSC renders a parent and its child concurrently, so a child that admits everyone
  // and then invalidates the billing cache is relying on render interleaving to stay correct.
  //
  // The roles whose treatment this line actually decides are `member` and `billing`, exactly as the
  // denylist intended. The difference is that the intent is now stated directly instead of inferred
  // from which roles were named for rejection.
  const canCreateWorkspaces = await withAuthorizationSurface("page", () =>
    can({ type: "user", id: session.user.id }, "organization.manage", {
      type: "organization",
      id: params.organizationId,
    })
  );
  if (!canCreateWorkspaces) return notFound();

  const organization = await getOrganization(params.organizationId);
  if (!organization) {
    throw new ResourceNotFoundError(t("common.organization"), params.organizationId);
  }

  if (IS_FORMBRICKS_CLOUD) {
    // Refresh trial/plan state after users return from onboarding billing actions.
    await invalidateOrganizationBillingCache(organization.id);
  }

  return <>{children}</>;
};

export default OnboardingLayout;
