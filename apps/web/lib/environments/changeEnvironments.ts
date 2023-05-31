export const changeEnvironment = (environmentType: string, environment: any, router: any) => {
  const newEnvironmentId = environment.product.environments.find((e) => e.type === environmentType)?.id;
  if (newEnvironmentId) {
    router.push(`/environments/${newEnvironmentId}/`);
  }
};

export const changeEnvironmentByProduct = (productId: string, environment: any, router: any) => {
  const product = environment.availableProducts.find((p) => p.id === productId);
  const newEnvironmentId = product?.environments[0]?.id;
  if (newEnvironmentId) {
    router.push(`/environments/${newEnvironmentId}/`);
  }
};

export const changeEnvironmentByTeam = (teamId: string, memberships: any, router: any) => {
  const newTeamMembership = memberships.find((m) => m.teamId === teamId);
  const newTeamProduct = newTeamMembership?.team?.products?.[0];

  if (newTeamProduct) {
    const newEnvironmentId = newTeamProduct.environments.find((e) => e.type === "production")?.id;

    if (newEnvironmentId) {
      router.push(`/environments/${newEnvironmentId}/`);
    }
  }
};
