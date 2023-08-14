import { TMembershipEnvironment } from "@formbricks/types/v1/membership";
import { TMembershipProduct } from "@formbricks/types/v1/membership";
import { TMembership } from "@formbricks/types/v1/membership";

export const changeEnvironment = (
  environmentType: string,
  environments: TMembershipEnvironment[],
  router: any
) => {
  const newEnvironmentId = environments.find((e) => e.type === environmentType)?.id;
  if (newEnvironmentId) {
    router.push(`/environments/${newEnvironmentId}/`);
  }
};

export const changeEnvironmentByProduct = (
  productId: string,
  availableProducts: TMembershipProduct[],
  router: any
) => {
  const product = availableProducts.find((p) => p.id === productId);
  const newEnvironmentId = product?.environments.find((env) => env.type === "production")?.id;
  if (newEnvironmentId) {
    router.push(`/environments/${newEnvironmentId}/`);
  }
};

export const changeEnvironmentByTeam = (teamId: string, memberships: TMembership[], router: any) => {
  const newTeamMembership = memberships.find((m) => m.teamId === teamId);
  const newTeamProduct = newTeamMembership?.team?.products?.[0];

  if (newTeamProduct) {
    const newEnvironmentId = newTeamProduct.environments.find((e) => e.type === "production")?.id;

    if (newEnvironmentId) {
      router.push(`/environments/${newEnvironmentId}/`);
    }
  }
};
