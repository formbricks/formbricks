"use client";

import { deleteProductAction } from "@/app/(app)/environments/[environmentId]/product/general/actions";
import { getFormattedErrorMessage } from "@/lib/utils/helper";
import { Alert, AlertDescription } from "@/modules/ui/components/alert";
import { Button } from "@/modules/ui/components/button";
import { DeleteDialog } from "@/modules/ui/components/delete-dialog";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import React, { useState } from "react";
import toast from "react-hot-toast";
import { FORMBRICKS_ENVIRONMENT_ID_LS } from "@formbricks/lib/localStorage";
import { truncate } from "@formbricks/lib/utils/strings";
import { TProduct } from "@formbricks/types/product";

type DeleteProductRenderProps = {
  isDeleteDisabled: boolean;
  isOwnerOrManager: boolean;
  product: TProduct;
};

export const DeleteProductRender = ({
  isDeleteDisabled,
  isOwnerOrManager,
  product,
}: DeleteProductRenderProps) => {
  const t = useTranslations();
  const router = useRouter();
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const handleDeleteProduct = async () => {
    setIsDeleting(true);
    const deleteProductResponse = await deleteProductAction({ productId: product.id });
    if (deleteProductResponse?.data) {
      localStorage.removeItem(FORMBRICKS_ENVIRONMENT_ID_LS);
      toast.success(t("environments.product.general.product_deleted_successfully"));
      router.push("/");
    } else {
      const errorMessage = getFormattedErrorMessage(deleteProductResponse);
      toast.error(errorMessage);
      setIsDeleteDialogOpen(false);
    }
    setIsDeleting(false);
  };

  return (
    <div>
      {!isDeleteDisabled && (
        <div>
          <p className="text-sm text-slate-900">
            {t(
              "environments.product.general.delete_product_name_includes_surveys_responses_people_and_more",
              {
                productName: truncate(product.name, 30),
              }
            )}{" "}
            <strong>{t("environments.product.general.this_action_cannot_be_undone")}</strong>
          </p>
          <Button
            disabled={isDeleteDisabled}
            variant="warn"
            className={`mt-4 ${isDeleteDisabled ? "ring-grey-500 ring-1 ring-offset-1" : ""}`}
            onClick={() => setIsDeleteDialogOpen(true)}>
            {t("common.delete")}
          </Button>
        </div>
      )}

      {isDeleteDisabled && (
        <Alert variant="warning">
          <AlertDescription>
            {!isOwnerOrManager
              ? t("environments.product.general.only_owners_or_managers_can_delete_products")
              : t("environments.product.general.cannot_delete_only_product")}
          </AlertDescription>
        </Alert>
      )}

      <DeleteDialog
        deleteWhat="Product"
        open={isDeleteDialogOpen}
        setOpen={setIsDeleteDialogOpen}
        onDelete={handleDeleteProduct}
        text={t("environments.product.general.delete_product_confirmation", {
          productName: truncate(product.name, 30),
        })}
        isDeleting={isDeleting}
      />
    </div>
  );
};
