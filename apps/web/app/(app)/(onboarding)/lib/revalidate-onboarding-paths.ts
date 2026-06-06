import "server-only";
import { revalidatePath } from "next/cache";

export const revalidateOnboardingWorkspacePaths = (organizationId: string): void => {
  revalidatePath(`/organizations/${organizationId}/workspaces/new`, "layout");
  revalidatePath(`/organizations/${organizationId}/workspaces/new/survey`);
  revalidatePath(`/organizations/${organizationId}/workspaces/new/ai`);
  revalidatePath(`/organizations/${organizationId}/workspaces/new/templates`);
  revalidatePath(`/organizations/${organizationId}/workspaces/new/plan`);
};
