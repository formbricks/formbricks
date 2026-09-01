import { redirect } from "next/navigation";
import { AuthenticationError, AuthorizationError, ResourceNotFoundError } from "@formbricks/types/errors";
import { withAuthorizationSurface } from "@/lib/authorization/context";
import { canUserAccessOrganization } from "@/lib/organization/auth";
import { getOrganization } from "@/lib/organization/service";
import { getUser } from "@/lib/user/service";
import { getTranslate } from "@/lingodotdev/server";
import { getSession } from "@/modules/auth/lib/session";
import { ToasterClient } from "@/modules/ui/components/toaster-client";

const WorkspaceOnboardingLayout = async (props: {
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

  const user = await getUser(session.user.id);
  if (!user) {
    throw new AuthenticationError(t("common.not_authenticated"));
  }

  // ENG-2388: `canUserAccessOrganization` already resolves through `can()` (`organization.read`), so
  // this needed only a surface. It matters more than it looks: this is the parent of the `landing`
  // and `workspaces/new` layouts wrapped in this same change, and a parent layout renders in its own
  // async context — the child's surface does not extend upward. Without this the org-level decision
  // guarding both of them stayed invisible to the rollout while its two children were comparable.
  const isAuthorized = await withAuthorizationSurface("page", () =>
    canUserAccessOrganization(session.user.id, params.organizationId)
  );

  if (!isAuthorized) {
    throw new AuthorizationError(t("common.not_authorized"));
  }

  const organization = await getOrganization(params.organizationId);
  if (!organization) {
    throw new ResourceNotFoundError(t("common.organization"), params.organizationId);
  }

  return (
    <div className="flex-1 bg-slate-50">
      <ToasterClient />
      {children}
    </div>
  );
};

export default WorkspaceOnboardingLayout;
