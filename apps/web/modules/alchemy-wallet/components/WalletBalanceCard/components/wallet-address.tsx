"use client";

import { useUser } from "@account-kit/react";
import Address from "./address";

export function WalletAddress() {
  const user = useUser();
  if (!user?.address) {
    return null;
  }

  return <Address address={user?.address} />;
}

export default WalletAddress;
