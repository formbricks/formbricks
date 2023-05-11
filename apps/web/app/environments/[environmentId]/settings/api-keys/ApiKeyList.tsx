"use client";

import LoadingSpinner from "@/components/shared/LoadingSpinner";
import { useProduct } from "@/lib/products/products";
import { ErrorComponent } from "@formbricks/ui";
import EditApiKeys from "./EditApiKeys";

export default function ApiKeyList({
  environmentId,
  environmentType,
}: {
  environmentId: string;
  environmentType: string;
}) {
  const { product, isLoadingProduct, isErrorProduct } = useProduct(environmentId);

  const findEnvironmentByType = (environments, targetType) => {
    for (const environment of environments) {
      if (environment.type === targetType) {
        return environment.id;
      }
    }
    return null;
  };

  if (isLoadingProduct) {
    return <LoadingSpinner />;
  }

  if (isErrorProduct) {
    <ErrorComponent />;
  }

  const environmentTypeId = findEnvironmentByType(product?.environments, environmentType);

  return <EditApiKeys environmentTypeId={environmentTypeId} environmentType={environmentType} />;
}
