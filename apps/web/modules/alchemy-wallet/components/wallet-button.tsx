"use client";

import { useAuthModal, useLogout, useSignerStatus, useUser } from "@account-kit/react";
import React from "react";

export function WalletButton(): React.JSX.Element {
  const user = useUser();
  const { openAuthModal } = useAuthModal();
  const signerStatus = useSignerStatus();
  const { logout } = useLogout();
  return (
    <div className="flex w-full items-center justify-center gap-4 p-2 text-center">
      {signerStatus.isInitializing ? (
        <>Loading...</>
      ) : user ? (
        <div className="flex flex-col gap-2">
          <p className="text-xl font-bold">Success!</p>
          You're logged in as {user.email ?? "anon"}.
          <button className="akui-btn akui-btn-primary mt-6" onClick={() => logout()}>
            Log out
          </button>
        </div>
      ) : (
        <button className="akui-btn akui-btn-primary flex-1" onClick={openAuthModal}>
          Login
        </button>
      )}
    </div>
  );
}

export default WalletButton;
