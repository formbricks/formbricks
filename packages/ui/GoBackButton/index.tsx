"use client";

import { ArrowLeftIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { Button } from "../Button";

export const GoBackButton = ({ url }: { url?: string }) => {
  const router = useRouter();
  return (
    <Button
      size="sm"
      variant="secondary"
      StartIcon={ArrowLeftIcon}
      onClick={() => {
        if (url) {
          router.push(url);
          return;
        }
        router.back();
      }}>
      Back
    </Button>
  );
};
