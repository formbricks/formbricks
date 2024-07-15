"use client";

import { ArrowLeftIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { Button } from "@formbricks/ui/Button";

export const BackButton = () => {
  const router = useRouter();
  return (
    <Button
      variant="secondary"
      StartIcon={ArrowLeftIcon}
      onClick={() => {
        router.back();
      }}>
      Back
    </Button>
  );
};
