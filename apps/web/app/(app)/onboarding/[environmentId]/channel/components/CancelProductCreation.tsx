"use client";

import { deleteProductAction } from "@/app/(app)/environments/[environmentId]/product/general/actions";
import { XIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
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
    <Button
      className="absolute right-5 top-5 !mt-0 text-slate-500 hover:text-slate-700"
      variant="minimal"
      onClick={cancelProductCreation}
      loading={isDeleting}>
      <XIcon className="h-7 w-7" strokeWidth={1.5} />
    </Button>
  );
};
