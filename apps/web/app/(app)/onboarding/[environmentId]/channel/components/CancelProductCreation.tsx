"use client";

import { deleteProductAction } from "@/app/(app)/environments/[environmentId]/product/general/actions";
import { useRouter } from "next/navigation";
import React, { useState } from "react";
import { Button } from "@formbricks/ui/Button";

interface CancelProductCreationProps {
  environmentId: string;
  productId: string;
}
export const CancelProductCreation = ({ environmentId, productId }: CancelProductCreationProps) => {
  const [isDeleting, setIsDeleting] = useState(false);
  const router = useRouter();
  const cancelProductCreation = async () => {
    try {
      setIsDeleting(true);
      await deleteProductAction(environmentId, productId);
      router.push("/");
    } catch (error) {
      setIsDeleting(false);
    }
  };
  return (
    <Button className="mt-6" variant="secondary" onClick={cancelProductCreation} loading={isDeleting}>
      Cancel Product Creation
    </Button>
  );
};
