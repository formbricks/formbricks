import { getMonthlyActivePeopleCount } from "@formbricks/lib/person/service";
import { getProducts } from "@formbricks/lib/product/service";
import { getMonthlyResponseCount } from "@formbricks/lib/response/service";

export const getTeamUsage = async (
  teamId: string
): Promise<{ peopleCount: number; responseCount: number }> => {
  let peopleCount = 0;
  let responseCount = 0;

  const products = await getProducts(teamId);

  for (const product of products) {
    for (const environment of product.environments) {
      const peopleInThisEnvironment = await getMonthlyActivePeopleCount(environment.id);
      const responsesInThisEnvironment = await getMonthlyResponseCount(environment.id);

      peopleCount += peopleInThisEnvironment;
      responseCount += responsesInThisEnvironment;
    }
  }

  return { peopleCount, responseCount };
};
