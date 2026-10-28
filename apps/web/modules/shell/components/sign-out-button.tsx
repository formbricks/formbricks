"use client";

import { LogOutIcon } from "lucide-react";
import { useSignOut } from "@/modules/auth/hooks/use-sign-out";

interface SignOutButtonProps {
  user: { id: string; email: string };
  organizationId: string;
  label: string;
}

export const SignOutButton = ({ user, organizationId, label }: Readonly<SignOutButtonProps>) => {
  const { signOut } = useSignOut(user);

  return (
    <button
      type="button"
      onClick={() =>
        signOut({
          reason: "user_initiated",
          redirectUrl: "/auth/login",
          callbackUrl: "/auth/login",
          organizationId,
          clearWorkspaceId: true,
        })
      }
      className="mt-1 flex h-8 items-center gap-2 rounded-md px-2.5 text-sm text-slate-600 hover:bg-slate-100 hover:text-slate-900 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-focus">
      <LogOutIcon className="size-4" aria-hidden="true" />
      {label}
    </button>
  );
};
