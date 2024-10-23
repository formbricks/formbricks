"use client";

import { deleteProductAction } from "@/app/(app)/environments/[environmentId]/product/general/actions";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import React, { useState } from "react";
import toast from "react-hot-toast";
import { getFormattedErrorMessage } from "@formbricks/lib/actionClient/helper";
import { truncate } from "@formbricks/lib/utils/strings";
import { TProduct } from "@formbricks/types/product";
import { Button } from "@formbricks/ui/components/Button";
import { DeleteDialog } from "@formbricks/ui/components/DeleteDialog";

type DeleteProductRenderProps = {
  isDeleteDisabled: boolean;
  isUserAdminOrOwner: boolean;
  product: TProduct;
};

export const DeleteProductRender = ({
  isDeleteDisabled,
  isUserAdminOrOwner,
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
      toast.success("Product deleted successfully.");
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
            Delete {truncate(product.name, 30)}
            &nbsp;incl. all surveys, responses, people, actions and attributes.{" "}
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
        <p className="text-sm text-red-700">
          {!isUserAdminOrOwner
            ? t("environments.product.general.only_admin_or_owners_can_delete_products")
            : t("environments.product.general.cannot_delete_only_product")}
        </p>
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
