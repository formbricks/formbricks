"use client";

import { signIn } from "next-auth/react";
import { Button } from "@/modules/ui/components/button";

interface MicrosoftButtonProps {
  callbackUrl: string;
}

export const MicrosoftButton = ({ callbackUrl }: MicrosoftButtonProps) => (
  <Button
    type="button"
    variant="secondary"
    className="w-full"
    onClick={() => signIn("azure-ad", { callbackUrl: callbackUrl || "/" })}>
    Sign in with Microsoft
  </Button>
);
